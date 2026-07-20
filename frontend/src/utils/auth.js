// frontend/src/utils/auth.js
// Manejo de la sesión en localStorage.
// Antes el usuario viajaba solo en location.state y se perdía al recargar (F5),
// lo que expulsaba al usuario al login aunque su token siguiera siendo válido.

const TOKEN_KEY = "token";
const USER_KEY = "user";

export function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Usuario efectivo: prioriza el que llega por navegación y cae al guardado.
export function resolveUser(stateUser) {
  return stateUser || getUser();
}
