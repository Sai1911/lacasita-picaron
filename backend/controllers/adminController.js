const db = require('../config/db');
const bcrypt = require('bcryptjs');

// =============================
//     PERSONAL
// =============================

// Listar personal
exports.getPersonal = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id_personal,
        p.nombre,
        p.apellido,
        p.dni,
        p.cargo,
        p.estado,
        p.intentos_fallidos,

        -- La cuenta queda bloqueada a los 5 intentos fallidos seguidos
        (p.intentos_fallidos >= 5) AS bloqueado,

        -- Campo artificial para que el frontend no falle
        0 AS operando

      FROM personal p
      WHERE p.cargo != 'Admin'
      ORDER BY p.cargo, p.nombre
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error getPersonal', err);
    res.status(500).json({ error: 'Error al obtener personal' });
  }
};

// Añadir personal
exports.addPersonal = async (req, res) => {
  const { nombre, apellido, dni, cargo, codigo_acceso, password } = req.body;

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO personal 
      (nombre, apellido, dni, codigo_acceso, password_hash, cargo, estado)
      VALUES (?, ?, ?, ?, ?, ?, 'activo')`,
      [nombre, apellido, dni, codigo_acceso, passwordHash, cargo]
    );

    res.json({ message: 'Personal creado correctamente' });
  } catch (err) {
    console.error('Error addPersonal', err);
    res.status(500).json({ error: 'Error al registrar personal' });
  }
};


// Editar personal
exports.updatePersonal = async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, cargo } = req.body;

  try {
    await db.query(
      `UPDATE personal 
       SET nombre=?, apellido=?, cargo=?
       WHERE id_personal=?`,
      [nombre, apellido, cargo, id]
    );

    res.json({ message: 'Datos de personal actualizados' });
  } catch (err) {
    console.error('Error updatePersonal', err);
    res.status(500).json({ error: 'Error al actualizar personal' });
  }
};

// Activar/desactivar personal
exports.togglePersonalState = async (req, res) => {
  const { id } = req.params;

  try {
    const [[person]] = await db.query(
      `SELECT estado FROM personal WHERE id_personal=?`,
      [id]
    );

    const newState = person.estado === 'activo' ? 'inactivo' : 'activo';

    await db.query(
      `UPDATE personal SET estado=? WHERE id_personal=?`,
      [newState, id]
    );

    res.json({ message: `Usuario ahora está ${newState}` });
  } catch (err) {
    console.error('Error togglePersonalState', err);
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
};

// Resetear la contraseña de un trabajador (solo Admin)
exports.resetPassword = async (req, res) => {
  const { id } = req.params;
  const { password_nueva } = req.body;

  if (!password_nueva || String(password_nueva).length < 6) {
    return res
      .status(400)
      .json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  try {
    const passwordHash = await bcrypt.hash(password_nueva, 10);

    // Al resetear también se desbloquea la cuenta
    const [result] = await db.query(
      `UPDATE personal
       SET password_hash = ?, intentos_fallidos = 0
       WHERE id_personal = ?`,
      [passwordHash, id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    res.json({ message: 'Contraseña restablecida y cuenta desbloqueada' });
  } catch (err) {
    console.error('Error resetPassword', err);
    res.status(500).json({ error: 'Error al restablecer la contraseña' });
  }
};

// Desbloquear una cuenta bloqueada por intentos fallidos (solo Admin)
exports.desbloquearPersonal = async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.query(
      `UPDATE personal SET intentos_fallidos = 0 WHERE id_personal = ?`,
      [id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }

    res.json({ message: 'Cuenta desbloqueada' });
  } catch (err) {
    console.error('Error desbloquearPersonal', err);
    res.status(500).json({ error: 'Error al desbloquear la cuenta' });
  }
};

// Bitácora de accesos (solo Admin)
exports.getLogSesiones = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.id_log,
             l.fecha_hora_inicio,
             l.fecha_hora_cierre,
             l.tipo_evento,
             p.nombre,
             p.apellido,
             p.cargo
      FROM logsesion l
      JOIN personal p ON p.id_personal = l.id_personal
      ORDER BY l.fecha_hora_inicio DESC
      LIMIT 100
    `);

    res.json(rows);
  } catch (err) {
    console.error('Error getLogSesiones', err);
    res.status(500).json({ error: 'Error al obtener la bitácora' });
  }
};

// Eliminar personal
exports.deletePersonal = async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      `DELETE FROM personal WHERE id_personal=?`,
      [id]
    );

    res.json({ message: 'Personal eliminado correctamente' });
  } catch (err) {
    console.error('Error deletePersonal', err);
    res.status(500).json({ error: 'Error al eliminar personal' });
  }
};

// =============================
//     MENÚ
// =============================

// Editar platillo
exports.updateMenuItem = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, categoria, precio } = req.body;

  try {
    await db.query(
      `UPDATE platillo 
       SET nombre=?, descripcion=?, categoria=?, precio=? 
       WHERE id_platillo=?`,
      [nombre, descripcion, categoria, precio, id]
    );

    res.json({ message: 'Platillo actualizado' });
  } catch (err) {
    console.error('Error updateMenuItem', err);
    res.status(500).json({ error: 'Error al actualizar platillo' });
  }
};

// Cambiar disponibilidad (visible u oculto)
exports.toggleMenuAvailability = async (req, res) => {
  const { id } = req.params;

  try {
    const [[item]] = await db.query(
      `SELECT disponibilidad FROM platillo WHERE id_platillo=?`,
      [id]
    );

    const newState = item.disponibilidad === 1 ? 0 : 1;

    await db.query(
      `UPDATE platillo SET disponibilidad=? WHERE id_platillo=?`,
      [newState, id]
    );

    res.json({ message: `Disponibilidad cambiada a ${newState}` });
  } catch (err) {
    console.error('Error toggleMenuAvailability', err);
    res.status(500).json({ error: 'Error al cambiar disponibilidad' });
  }
};

// Eliminar platillo
exports.deleteMenuItem = async (req, res) => {
  const { id } = req.params;

  try {
    // Si el platillo ya se vendió, la clave foránea impide borrarlo:
    // eso protege el histórico. En ese caso se sugiere desactivarlo.
    const [[usado]] = await db.query(
      `SELECT 1 FROM detalle_comanda WHERE id_platillo = ? LIMIT 1`,
      [id]
    );

    if (usado) {
      return res.status(409).json({
        error:
          "Este platillo ya aparece en pedidos y no puede eliminarse. Desactívalo (ON/OFF) para dejar de ofrecerlo.",
      });
    }

    await db.query(`DELETE FROM platillo WHERE id_platillo=?`, [id]);

    res.json({ message: 'Platillo eliminado correctamente' });
  } catch (err) {
    console.error('Error deleteMenuItem', err);
    res.status(500).json({ error: 'Error al eliminar platillo' });
  }
};

// Cambiar disponibilidad ON/OFF de un platillo
exports.toggleMenuAvailability = async (req, res) => {
  const { id } = req.params;

  try {
    // Obtener estado actual
    const [[platillo]] = await db.query(
      "SELECT disponibilidad FROM platillo WHERE id_platillo = ?",
      [id]
    );

    if (!platillo) {
      return res.status(404).json({ error: "Platillo no encontrado" });
    }

    // Cambiar 1 → 0 o 0 → 1
    const nuevoEstado = platillo.disponibilidad === 1 ? 0 : 1;

    // Actualizar BD
    await db.query(
      "UPDATE platillo SET disponibilidad = ? WHERE id_platillo = ?",
      [nuevoEstado, id]
    );

    res.json({
      message: "Disponibilidad actualizada",
      disponibilidad: nuevoEstado,
    });
  } catch (error) {
    console.error("Error toggleMenuAvailability:", error);
    res.status(500).json({ error: "Error al cambiar disponibilidad" });
  }
};