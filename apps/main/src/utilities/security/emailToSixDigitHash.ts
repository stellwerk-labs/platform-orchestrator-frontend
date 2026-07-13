export const emailToSixDigitHash = async (email: string) => {
  const normalizedEmail = email.toLowerCase();
  const msgUint8 = new TextEncoder().encode(normalizedEmail);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashedEmail = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const hashInt = parseInt(hashedEmail.slice(0, 8), 16); // Take 8 hex chars = 32 bits
  const sixDigit = (hashInt % 1000000).toString().padStart(6, '0');
  return sixDigit;
};
