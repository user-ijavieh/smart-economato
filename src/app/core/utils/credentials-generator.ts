/**
 * Genera un nombre de usuario con formato SE + 8 dígitos aleatorios.
 * Ejemplo: SE48301572, SE00293847
 * Combinaciones posibles: 100,000,000
 */
export function generateUsername(): string {
    const prefix = 'SE';
    const randomNumber = Math.floor(Math.random() * 100_000_000);
    return `${prefix}${String(randomNumber).padStart(8, '0')}`;
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
