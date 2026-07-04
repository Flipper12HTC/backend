// A wallet is just its base58 public key string at the domain level.
export type WalletAddress = string;

// CDC anonymity rule (UC-B02): never display the full wallet, always XXX...XXX.
export function shortenWallet(addr: WalletAddress, lead = 4, tail = 4): string {
  if (addr.length <= lead + tail + 3) return addr;
  return `${addr.slice(0, lead)}...${addr.slice(-tail)}`;
}
