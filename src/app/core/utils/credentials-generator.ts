/**
 * Genera un nombre de usuario único con el formato:
 * [Letra][timestamp en base36][número aleatorio][Letra]
 *
 * Ejemplo: "A-lk2f8x-42-M"
 *
 * - La letra inicial y final son aleatorias (A-Z)
 * - El timestamp (Date.now()) se convierte a base36 para acortar
 * - El número aleatorio es de 2 dígitos (10-99)
 */
export function generateUsername(): string {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const firstLetter = letters[Math.floor(Math.random() * letters.length)];
    const lastLetter = letters[Math.floor(Math.random() * letters.length)];
    const timestamp = Date.now().toString(36);
    const randomNumber = Math.floor(Math.random() * 90 + 10); // 10–99

    return `${firstLetter}${timestamp}${randomNumber}${lastLetter}`;
}

/**
 * Genera una contraseña por defecto de 8 caracteres.
 * Incluye al menos: 1 mayúscula, 1 minúscula, 1 dígito y 1 símbolo.
 *
 * Ejemplo: "kA3$xR7m"
 */
export function generatePassword(): string {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%&*';
    const all = upper + lower + digits + symbols;

    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];

    // Garantizar al menos uno de cada tipo
    const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];

    // Rellenar los 4 caracteres restantes con el pool completo
    for (let i = 0; i < 4; i++) {
        required.push(pick(all));
    }

    // Mezclar el array para que los obligatorios no queden siempre al inicio
    for (let i = required.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [required[i], required[j]] = [required[j], required[i]];
    }

    return required.join('');
}
