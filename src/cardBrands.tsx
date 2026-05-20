import React from "react";

export type CardNetwork = "VISA" | "MASTERCARD";

export type CardBrand = {
  id: string;
  name: string;
  matches: RegExp;
  background: string;
  textClass: string;
  Logo: React.FC<{ className?: string }>;
  network: CardNetwork;
  subtitle: string;
  Decoration?: React.FC;
};

const RedotPayLogo: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`flex items-center justify-center rounded-lg bg-white ${className ?? ""}`}
  >
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2">
      <path
        d="M6 4h7a5 5 0 0 1 0 10h-3v6H6V4Zm4 3v4h3a2 2 0 1 0 0-4h-3Z"
        fill="#E0114B"
      />
      <circle cx="17.5" cy="17.5" r="2.5" fill="#E0114B" />
    </svg>
  </div>
);

const RedotPayDecoration: React.FC = () => (
  <svg
    viewBox="0 0 200 200"
    className="absolute -right-12 -bottom-16 h-56 w-56 opacity-15"
    aria-hidden
  >
    <path
      d="M40 20h70a40 40 0 0 1 0 80h-30v60H40V20Zm40 30v20h30a10 10 0 1 0 0-20H80Z"
      fill="white"
    />
    <circle cx="135" cy="145" r="22" fill="white" />
  </svg>
);

const BybitLogo: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`flex items-center justify-center rounded-lg bg-[#F7A600] ${className ?? ""}`}
  >
    <span className="font-black text-black leading-none text-xl">B</span>
  </div>
);

const NexoLogo: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`flex items-center justify-center rounded-lg bg-white ${className ?? ""}`}
  >
    <svg viewBox="0 0 24 24" className="h-1/2 w-1/2" fill="#1A4DFF">
      <path d="M4 4h3.5l9 11V4H20v16h-3.5l-9-11v11H4V4Z" />
    </svg>
  </div>
);

const BitnovoLogo: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`flex items-center justify-center rounded-lg bg-white ${className ?? ""}`}
  >
    <span className="font-black text-[#FF6B00] leading-none text-xl">b</span>
  </div>
);

export const CARD_BRANDS: CardBrand[] = [
  {
    id: "redotpay",
    name: "RedotPay",
    matches: /redot/i,
    background:
      "bg-[radial-gradient(circle_at_top_left,#FF3D6D_0%,#E0114B_55%,#9E0A36_100%)]",
    textClass: "text-white",
    Logo: RedotPayLogo,
    network: "VISA",
    subtitle: "DEBIT · VISA",
    Decoration: RedotPayDecoration,
  },
  {
    id: "bybit",
    name: "Bybit",
    matches: /bybit/i,
    background:
      "bg-[linear-gradient(135deg,#1B1B1B_0%,#2A2A2A_60%,#F7A600_180%)]",
    textClass: "text-white",
    Logo: BybitLogo,
    network: "MASTERCARD",
    subtitle: "DEBIT · MASTERCARD",
  },
  {
    id: "nexo",
    name: "Nexo",
    matches: /nexo/i,
    background:
      "bg-[linear-gradient(135deg,#0A0F2C_0%,#142157_55%,#1A4DFF_120%)]",
    textClass: "text-white",
    Logo: NexoLogo,
    network: "MASTERCARD",
    subtitle: "CREDIT · MASTERCARD",
  },
  {
    id: "bitnovo",
    name: "Bitnovo",
    matches: /bitnovo/i,
    background:
      "bg-[linear-gradient(135deg,#FF6B00_0%,#FF8A2A_55%,#FFB068_100%)]",
    textClass: "text-white",
    Logo: BitnovoLogo,
    network: "VISA",
    subtitle: "PREPAID · VISA",
  },
];

export function matchCardBrand(label: string | undefined): CardBrand | null {
  if (!label) return null;
  return CARD_BRANDS.find((b) => b.matches.test(label)) ?? null;
}

export const VisaMark: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={`font-black italic tracking-tight text-white ${className ?? ""}`}
    style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
  >
    VISA
  </span>
);

export const MastercardMark: React.FC<{ className?: string }> = ({
  className,
}) => (
  <span
    className={`relative inline-flex items-center ${className ?? ""}`}
    aria-label="Mastercard"
  >
    <span className="block size-5 rounded-full bg-[#EB001B]" />
    <span className="block size-5 -ml-2 rounded-full bg-[#F79E1B] mix-blend-screen" />
  </span>
);

export const NetworkMark: React.FC<{
  network: CardNetwork;
  className?: string;
}> = ({ network, className }) =>
  network === "VISA" ? (
    <VisaMark className={className} />
  ) : (
    <MastercardMark className={className} />
  );
