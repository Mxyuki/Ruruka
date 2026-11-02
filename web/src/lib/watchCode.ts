// <-- Ni 0/O ni 1/I/L : un code dicté sur Discord se recopie sans hésiter -->
const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const codeLength = 10;
const halfLength = codeLength / 2;

const format = (characters: string) => `${characters.slice(0, halfLength)}-${characters.slice(halfLength)}`;

/** A new group watch code such as "7KX3P-QM9TZ" (about 50 bits of randomness, it also keys the encryption). */
export function createWatchCode(): string {
  const characters: string[] = [];
  // <-- Les octets au-delà du dernier multiple de l'alphabet sont rejetés, pour que chaque caractère reste équiprobable -->
  const limit = 256 - (256 % alphabet.length);
  while (characters.length < codeLength) {
    for (const byte of crypto.getRandomValues(new Uint8Array(codeLength))) {
      if (byte < limit && characters.length < codeLength) characters.push(alphabet.charAt(byte % alphabet.length));
    }
  }
  return format(characters.join(''));
}

/** The code as `createWatchCode` writes it, whatever the case and separators typed; null when it isn't one. */
export function normalizeWatchCode(typed: string): string | null {
  const characters = typed.toUpperCase().replace(/[\s-]/g, '');
  if (characters.length !== codeLength || [...characters].some((character) => !alphabet.includes(character))) return null;
  return format(characters);
}
