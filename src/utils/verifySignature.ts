import { VerifAlgo } from "./types";

let encoder = new TextEncoder();

/**
 * Converts a hexadecimal string to a byte array.
 * @param hex The hexadecimal string to convert.
 * @returns The byte array.
 */
function hexToBytes(hex: string): Uint8Array {
    let len: number = hex.length / 2;
    let bytes: Uint8Array = new Uint8Array(len);

    let index: number = 0;
    for (let i = 0; i < hex.length; i += 2) {
        let c: string = hex.slice(i, i + 2);
        let b: number = parseInt(c, 16);
        bytes[index] = b;
        index += 1;
    }

    return bytes;
}

/**
 * Verifies the signature of a payload.
 * @param secret The secret used to sign the payload.
 * @param header The header containing the signature.
 * @param payload The payload to verify.
 * @returns Whether the signature is valid.
 * @see https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export default async (secret: string, header: string, payload: string): Promise<boolean> => {
    let parts: string[] = header.split("=");
    let sigHex: string = parts[1];

    let algorithm: VerifAlgo = { name: "HMAC", hash: { name: 'SHA-256' } };

    let keyBytes: Uint8Array = encoder.encode(secret);
    let extractable: boolean = false;
    let key: CryptoKey = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        algorithm,
        extractable,
        [ "sign", "verify" ],
    );

    let sigBytes: Uint8Array = hexToBytes(sigHex);
    let dataBytes: Uint8Array = encoder.encode(payload);
    let equal: boolean = await crypto.subtle.verify(
        algorithm.name,
        key,
        sigBytes,
        dataBytes,
    );

    return equal;
}