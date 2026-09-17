import { isIP } from 'node:net';

/** Exact operator-owned proxy peers only; never accept Express aliases or CIDRs. */
export function parseTrustedProxyIps(
  value: string | undefined,
): false | string[] {
  if (value === undefined || value.trim() === '') return false;

  const peers = value.split(',').map((peer) => peer.trim());
  if (peers.some((peer) => !isIP(peer) || peer.includes('%'))) {
    // Do not reflect potentially sensitive or control-character-bearing input.
    throw new Error(
      'TRUSTED_PROXY_IPS must be a comma-separated list of exact IP addresses',
    );
  }
  return peers;
}
