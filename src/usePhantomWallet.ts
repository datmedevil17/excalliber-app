import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import 'react-native-get-random-values';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const APP_URL      = 'https://excalibur.gg';
const REDIRECT     = 'excalibur://onConnect';
const CLUSTER      = 'mainnet-beta';

export type WalletState =
  | { status: 'disconnected' }
  | { status: 'connecting' }
  | { status: 'connected'; publicKey: string; session: string }
  | { status: 'error'; message: string };

export function usePhantomWallet() {
  const [state, setState] = useState<WalletState>({ status: 'disconnected' });
  const keypairRef = useRef<nacl.BoxKeyPair | null>(null);

  const connect = useCallback(async () => {
    const kp = nacl.box.keyPair();
    keypairRef.current = kp;

    const params = new URLSearchParams({
      app_url:                      APP_URL,
      dapp_encryption_public_key:   bs58.encode(kp.publicKey),
      redirect_link:                REDIRECT,
      cluster:                      CLUSTER,
    });

    setState({ status: 'connecting' });
    try {
      await Linking.openURL(`phantom://v1/connect?${params.toString()}`);
    } catch {
      setState({ status: 'error', message: 'Phantom app not installed' });
    }
  }, []);

  const disconnect = useCallback(() => {
    keypairRef.current = null;
    setState({ status: 'disconnected' });
  }, []);

  useEffect(() => {
    function handleUrl({ url }: { url: string }) {
      if (!url.startsWith('excalibur://onConnect')) return;

      let parsed: URL;
      try { parsed = new URL(url); } catch { return; }

      const errorCode = parsed.searchParams.get('errorCode');
      if (errorCode) {
        setState({ status: 'error', message: parsed.searchParams.get('errorMessage') ?? 'Wallet error' });
        return;
      }

      const phantomKey = parsed.searchParams.get('phantom_encryption_public_key');
      const nonce      = parsed.searchParams.get('nonce');
      const data       = parsed.searchParams.get('data');

      if (!phantomKey || !nonce || !data || !keypairRef.current) {
        setState({ status: 'error', message: 'Invalid Phantom response' });
        return;
      }

      try {
        const shared = nacl.box.before(bs58.decode(phantomKey), keypairRef.current.secretKey);
        const box    = nacl.box.open.after(bs58.decode(data), bs58.decode(nonce), shared);
        if (!box) { setState({ status: 'error', message: 'Decryption failed' }); return; }

        const text = Array.from(box).reduce((acc, b) => acc + String.fromCharCode(b), '');
        const { public_key, session } = JSON.parse(text) as { public_key: string; session: string };
        setState({ status: 'connected', publicKey: public_key, session });
      } catch (e: any) {
        setState({ status: 'error', message: e?.message ?? 'Parse error' });
      }
    }

    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    return () => sub.remove();
  }, []);

  return { state, connect, disconnect };
}
