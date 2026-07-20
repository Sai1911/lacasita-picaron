const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Intentos fallidos consecutivos antes de bloquear la cuenta
const MAX_INTENTOS = 5;

// Mensaje único para código inexistente Y contraseña incorrecta.
// Si fueran distintos, se podrían descubrir códigos de acceso válidos
// probando uno por uno (enumeración de usuarios).
const CREDENCIALES_INVALIDAS = "Código de acceso o contraseña incorrectos";

// Registra un evento en la bitácora de sesiones (logsesion).
// Nunca debe tumbar el login: si falla, solo se avisa por consola.
async function registrarEvento(idPersonal, tipoEvento) {
  try {
    await db.query(
      `INSERT INTO logsesion (id_personal, fecha_hora_inicio, tipo_evento)
       VALUES (?, NOW(), ?)`,
      [idPersonal, tipoEvento]
    );
  } catch (err) {
    console.error("No se pudo registrar el evento de sesión:", err.message);
  }
}

// ============================================================
// LOGIN
// ============================================================
exports.login = async (req, res) => {
  const { codigo_acceso, password } = req.body;

  if (!codigo_acceso || !password) {
    return res
      .status(400)
      .json({ message: "El código de acceso y la contraseña son obligatorios" });
  }

  try {
    const [[user]] = await db.query(
      "SELECT * FROM personal WHERE codigo_acceso = ?",
      [codigo_acceso]
    );

    // Mismo status y mensaje que una contraseña incorrecta (ver arriba)
    if (!user) {
      return res.status(401).json({ message: CREDENCIALES_INVALIDAS });
    }

    // Un trabajador desactivado por el admin no puede entrar.
    // Antes esta comprobación no existía: el botón activo/inactivo no servía.
    if (user.estado !== "activo") {
      return res.status(403).json({
        message: "Tu usuario está inactivo. Contacta al administrador.",
      });
    }

    if ((user.intentos_fallidos || 0) >= MAX_INTENTOS) {
      return res.status(403).json({
        message:
          "Cuenta bloqueada por intentos fallidos. Contacta al administrador.",
      });
    }

    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      const intentos = (user.intentos_fallidos || 0) + 1;

      await db.query(
        "UPDATE personal SET intentos_fallidos = ? WHERE id_personal = ?",
        [intentos, user.id_personal]
      );

      await registrarEvento(user.id_personal, "login_fallido");

      if (intentos >= MAX_INTENTOS) {
        return res.status(403).json({
          message:
            "Cuenta bloqueada por intentos fallidos. Contacta al administrador.",
        });
      }

      return res.status(401).json({ message: CREDENCIALES_INVALIDAS });
    }

    // Login correcto: se reinicia el contador de intentos
    await db.query(
      "UPDATE personal SET intentos_fallidos = 0 WHERE id_personal = ?",
      [user.id_personal]
    );

    await registrarEvento(user.id_personal, "login");

    const token = jwt.sign(
      { id: user.id_personal, rol: user.cargo },
      process.env.SECRET_KEY,
      { expiresIn: "12h" }
    );

    res.json({
      message: "Login exitoso",
      token,
      rol: user.cargo,
      nombre: user.nombre,
      id_personal: user.id_personal,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// ============================================================
// LOGOUT
// El JWT no se puede invalidar en el servidor (es stateless), pero
// sí se cierra el registro de la sesión para la auditoría.
// ============================================================
exports.logout = async (req, res) => {
  try {
    await db.query(
      `UPDATE logsesion
       SET fecha_hora_cierre = NOW()
       WHERE id_log = (
         SELECT id_log FROM logsesion
         WHERE id_personal = ?
           AND tipo_evento = 'login'
           AND fecha_hora_cierre IS NULL
         ORDER BY fecha_hora_inicio DESC
         LIMIT 1
       )`,
      [req.user.id]
    );

    res.json({ message: "Sesión cerrada" });
  } catch (err) {
    console.error("logout:", err);
    res.status(500).json({ error: "Error cerrando la sesión" });
  }
};

// ============================================================
// CAMBIO DE CONTRASEÑA (el propio usuario)
// ============================================================
exports.cambiarPassword = async (req, res) => {
  const { password_actual, password_nueva } = req.body;

  if (!password_actual || !password_nueva) {
    return res
      .status(400)
      .json({ message: "Debes enviar la contraseña actual y la nueva" });
  }

  if (String(password_nueva).length < 6) {
    return res
      .status(400)
      .json({ message: "La nueva contraseña debe tener al menos 6 caracteres" });
  }

  if (password_actual === password_nueva) {
    return res
      .status(400)
      .json({ message: "La nueva contraseña debe ser distinta de la actual" });
  }

  try {
    const [[user]] = await db.query(
      "SELECT password_hash FROM personal WHERE id_personal = ?",
      [req.user.id]
    );

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const valid = await bcrypt.compare(password_actual, user.password_hash);
    if (!valid) {
      return res
        .status(401)
        .json({ message: "La contraseña actual no es correcta" });
    }

    const nuevoHash = await bcrypt.hash(password_nueva, 10);

    await db.query(
      "UPDATE personal SET password_hash = ? WHERE id_personal = ?",
      [nuevoHash, req.user.id]
    );

    await registrarEvento(req.user.id, "cambio_password");

    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("cambiarPassword:", err);
    res.status(500).json({ error: "Error al cambiar la contraseña" });
  }
};
