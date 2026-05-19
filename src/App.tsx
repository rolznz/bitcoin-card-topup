import React from "react";
import {
  disconnect,
  init,
  launchModal,
  onConnected,
  onConnecting,
  onDisconnected,
} from "@getalby/bitcoin-connect-react";
import { getFiatValue } from "@getalby/lightning-tools";
import type { WebLNProvider } from "@webbtc/webln-types";
import PullToRefresh from "pulltorefreshjs";
import type { SwapStatus } from "@lendasat/lendaswap-sdk-pure";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { SetupForm } from "./components/SetupForm";
import {
  clearCardConfig,
  loadCardConfig,
  saveCardConfig,
  type CardConfig,
} from "./config";
import {
  claimSwap,
  createTopupSwap,
  subscribeToSwap,
  SUPPORTED_CHAINS,
} from "./lendaswap";

const PRESET_AMOUNTS = [10, 25, 100];
const MIN_AMOUNT_USD = 2;

init({
  appName: "Bitcoin Card Topup",
});

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function chainName(chainId: number): string {
  return (
    SUPPORTED_CHAINS.find((c) => c.chainId === chainId)?.name ??
    `Chain ${chainId}`
  );
}

// Terminal statuses where we should stop subscribing and decide success/refund.
const SUCCESS_STATUSES: SwapStatus[] = ["clientredeemed", "serverredeemed"];
const FAILURE_STATUSES: SwapStatus[] = [
  "expired",
  "clientrefunded",
  "clientrefundedserverrefunded",
  "clientrefundedserverfunded",
  "clientinvalidfunded",
  "clientfundedtoolate",
  "serverwontfund",
];

function statusLabel(status: SwapStatus | undefined): string {
  switch (status) {
    case undefined:
      return "Preparing swap…";
    case "pending":
      return "Waiting for Lightning payment…";
    case "clientfundingseen":
      return "Lightning payment seen…";
    case "clientfunded":
      return "Lightning payment received, funding card…";
    case "serverfunded":
      return "Claiming on-chain…";
    case "clientredeeming":
      return "Claiming on-chain…";
    case "clientredeemed":
    case "serverredeemed":
      return "Done!";
    default:
      return status;
  }
}

function App() {
  const [config, setConfig] = React.useState<CardConfig | null>(() =>
    loadCardConfig(),
  );
  const [editing, setEditing] = React.useState(false);
  const [provider, setProvider] = React.useState<WebLNProvider>();
  const [isLoadingWallet, setLoadingWallet] = React.useState(false);
  const [walletBalance, setWalletBalance] = React.useState<number>();
  const [walletUsdValue, setWalletUsdValue] = React.useState<number>();
  const [walletUsdError, setWalletUsdError] = React.useState(false);

  const [selectedAmount, setSelectedAmount] = React.useState<number | null>(
    10,
  );
  const [isTopping, setTopping] = React.useState(false);
  const [swapStatus, setSwapStatus] = React.useState<SwapStatus | undefined>();
  const [error, setError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    const unsubConnected = onConnected(async (p) => {
      setProvider(p);
      setLoadingWallet(false);
      try {
        const balance = await p.getBalance?.();
        if (balance) setWalletBalance(balance.balance);
      } catch {
        // ignore — wallet might not support getBalance
      }
    });
    const unsubConnecting = onConnecting(() => setLoadingWallet(true));
    const unsubDisconnected = onDisconnected(() => {
      setProvider(undefined);
      setLoadingWallet(false);
      setWalletBalance(undefined);
      setWalletUsdValue(undefined);
      setWalletUsdError(false);
    });
    return () => {
      unsubConnected();
      unsubConnecting();
      unsubDisconnected();
    };
  }, []);

  React.useEffect(() => {
    if (walletBalance === undefined) return;
    setWalletUsdError(false);
    getFiatValue({ satoshi: walletBalance, currency: "USD" })
      .then(setWalletUsdValue)
      .catch(() => setWalletUsdError(true));
  }, [walletBalance]);

  React.useEffect(() => {
    PullToRefresh.init({
      mainElement: "body",
      onRefresh: () => window.location.reload(),
    });
  }, []);

  function handleSaveConfig(next: CardConfig) {
    saveCardConfig(next);
    setConfig(next);
    setEditing(false);
  }

  function handleForgetCard() {
    if (!confirm("Forget this card? You'll need to re-enter its details.")) {
      return;
    }
    clearCardConfig();
    setConfig(null);
    setSelectedAmount(null);
  }

  async function handleTopup() {
    if (!config || !provider || !selectedAmount) return;
    if (selectedAmount < MIN_AMOUNT_USD) {
      setError(`Minimum top up is $${MIN_AMOUNT_USD}.`);
      return;
    }

    setTopping(true);
    setError(null);
    setSuccessMessage(null);
    setSwapStatus(undefined);
    let unsubscribe: (() => void) | undefined;

    try {
      const swap = await createTopupSwap({
        chainId: config.chainId,
        currency: config.currency,
        amountUsd: selectedAmount,
        targetAddress: config.destinationAddress,
      });
      setSwapStatus(swap.status);

      const paymentPromise = provider.sendPayment(swap.bolt11_invoice);

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const settle = (fn: () => void) => {
          if (settled) return;
          settled = true;
          fn();
        };

        let claimStarted = false;
        subscribeToSwap(swap.id, (_swapId, status) => {
          setSwapStatus(status);
          if (status === "serverfunded" && !claimStarted) {
            claimStarted = true;
            claimSwap(swap.id).catch((err) =>
              settle(() => reject(err instanceof Error ? err : new Error(String(err)))),
            );
          }
          if (SUCCESS_STATUSES.includes(status)) {
            settle(() => resolve());
          } else if (FAILURE_STATUSES.includes(status)) {
            settle(() => reject(new Error(`Swap ${status}`)));
          }
        }).then((unsub) => {
          unsubscribe = unsub;
        });

        paymentPromise.catch((err) =>
          settle(() => reject(err instanceof Error ? err : new Error(String(err)))),
        );
      });

      setSuccessMessage(
        `Sent $${selectedAmount} ${config.currency} to ${truncateAddress(
          config.destinationAddress,
        )}.`,
      );
      setSelectedAmount(10);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      unsubscribe?.();
      setTopping(false);
    }
  }

  if (!config || editing) {
    return (
      <div className="min-h-screen bg-base-100">
        <div className="navbar bg-base-100">
          <div className="flex-1">
            <h1 className="text-xl font-bold px-2">Bitcoin Card Topup</h1>
          </div>
        </div>
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <SetupForm
              initial={editing ? config : null}
              onSave={handleSaveConfig}
              onCancel={editing ? () => setEditing(false) : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  const isWalletConnected = !!provider || isLoadingWallet;

  return (
    <div className="min-h-screen bg-base-100">
      <div className="navbar bg-base-100">
        <div className="flex-1">
          <h1 className="text-xl font-bold px-2">Bitcoin Card Topup</h1>
        </div>
        <div className="flex-none">
          <HamburgerMenu
            isCardConfigured={!!config}
            isWalletConnected={isWalletConnected}
            onEditCard={() => setEditing(true)}
            onForgetCard={handleForgetCard}
            onDisconnectWallet={() => disconnect()}
          />
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          <div className="card bg-primary text-primary-content">
            <div className="card-body">
              <h2 className="card-title">{config.label || "Card"}</h2>
              <p className="font-mono text-sm break-all">
                {truncateAddress(config.destinationAddress)}
              </p>
              <div className="flex gap-2 mt-2">
                <span className="badge badge-outline">
                  {chainName(config.chainId)}
                </span>
                <span className="badge badge-outline">{config.currency}</span>
              </div>
            </div>
          </div>

          {(walletBalance !== undefined || isLoadingWallet || provider) && (
            <div className="card bg-secondary text-secondary-content">
              <div className="card-body">
                <h2 className="card-title">Wallet Balance</h2>
                {walletBalance === undefined ? (
                  <p className="text-2xl font-bold">Loading…</p>
                ) : walletUsdError ? (
                  <>
                    <p className="text-2xl font-bold text-error">
                      Failed to load USD rate
                    </p>
                    <p className="text-sm opacity-80">
                      {`${new Intl.NumberFormat().format(walletBalance)} sats`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold">
                      {walletUsdValue !== undefined
                        ? new Intl.NumberFormat(undefined, {
                            style: "currency",
                            currency: "USD",
                          }).format(walletUsdValue)
                        : "Loading…"}
                    </p>
                    <p className="text-sm opacity-80">
                      {`${new Intl.NumberFormat().format(walletBalance)} sats`}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {!provider && !isLoadingWallet && (
            <button
              className="btn btn-outline btn-lg w-full"
              onClick={() => launchModal()}
            >
              Connect Lightning wallet
            </button>
          )}
          {isLoadingWallet && !provider && (
            <button className="btn btn-outline btn-lg w-full" disabled>
              <span className="loading loading-spinner"></span>
              Connecting…
            </button>
          )}

          {provider && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Amount</p>
                <div className="grid grid-cols-2 gap-3">
                  {PRESET_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      className={`btn btn-lg ${
                        selectedAmount === amount
                          ? "btn-primary"
                          : "btn-outline"
                      }`}
                      onClick={() => setSelectedAmount(amount)}
                      disabled={isTopping}
                    >
                      ${amount}
                    </button>
                  ))}
                  <button
                    className={`btn btn-lg ${
                      selectedAmount !== null &&
                      !PRESET_AMOUNTS.includes(selectedAmount)
                        ? "btn-primary"
                        : "btn-outline"
                    }`}
                    onClick={() => {
                      const input = prompt(
                        `Enter amount in USD (minimum $${MIN_AMOUNT_USD})`,
                      );
                      if (!input) return;
                      const value = parseFloat(input);
                      if (Number.isNaN(value) || value < MIN_AMOUNT_USD) {
                        alert(`Minimum top up amount is $${MIN_AMOUNT_USD}`);
                        return;
                      }
                      setSelectedAmount(value);
                    }}
                    disabled={isTopping}
                  >
                    {selectedAmount !== null &&
                    !PRESET_AMOUNTS.includes(selectedAmount)
                      ? `$${selectedAmount}`
                      : "Custom"}
                  </button>
                </div>
              </div>

              <button
                className="btn btn-primary btn-lg w-full"
                disabled={!selectedAmount || isTopping}
                onClick={handleTopup}
              >
                {isTopping ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    {statusLabel(swapStatus)}
                  </>
                ) : selectedAmount ? (
                  `Top up $${selectedAmount}`
                ) : (
                  "Select an amount"
                )}
              </button>
            </div>
          )}

          {error && (
            <div role="alert" className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          {successMessage && (
            <div role="alert" className="alert alert-success">
              <span>{successMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
