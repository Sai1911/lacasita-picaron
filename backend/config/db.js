require("dotenv").config();
const { Pool } = require("pg");

// ============================================================
// Conexión a PostgreSQL
// - En Render/producción se usa DATABASE_URL (con SSL).
// - En local se puede usar DATABASE_URL o las variables sueltas.
// ============================================================
const useConnectionString = !!process.env.DATABASE_URL;

const pool = new Pool(
  useConnectionString
    ? {
        connectionString: process.env.DATABASE_URL,
        // Render exige SSL. En local (localhost) lo desactivamos.
        ssl: /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
          ? false
          : { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 5432,
      }
);

pool.on("error", (err) => {
  console.error("🔥 Error inesperado en el pool de PostgreSQL:", err);
});

// ============================================================
// Capa de compatibilidad estilo mysql2
// Permite que los controllers sigan usando:
//   const [rows] = await db.query("... WHERE x = ?", [valor]);
//   const [result] = await db.query("INSERT ...");  // result.insertId
// ------------------------------------------------------------
// - Convierte los placeholders "?" a "$1, $2, ..." de PostgreSQL.
// - En INSERT añade "RETURNING *" para emular insertId.
// - Devuelve [rows|okPacket, fields] igual que mysql2.
// ============================================================
function convertPlaceholders(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

function prepararSQL(sql) {
  let text = convertPlaceholders(sql);
  const isInsert = /^\s*insert/i.test(text);

  // Emular insertId de MySQL: si es INSERT y no trae RETURNING, lo agregamos.
  if (isInsert && !/returning/i.test(text)) {
    text = text.replace(/;?\s*$/, " RETURNING *");
  }

  return text;
}

function formatearResultado(result) {
  if (result.command === "SELECT") {
    return [result.rows, result.fields];
  }

  // INSERT / UPDATE / DELETE → emulamos el OkPacket de mysql2
  const firstRow = result.rows && result.rows[0];
  const okPacket = {
    insertId: firstRow ? Object.values(firstRow)[0] : undefined,
    affectedRows: result.rowCount,
    rowCount: result.rowCount,
  };
  return [okPacket, result.fields];
}

// Consulta suelta (cada una en su propia conexión del pool)
async function query(sql, params = []) {
  const result = await pool.query(prepararSQL(sql), params);
  return formatearResultado(result);
}

// ============================================================
// Transacciones
// Uso:
//   await db.withTransaction(async (tx) => {
//     const [r] = await tx.query("INSERT ...", [...]);
//     await tx.query("UPDATE ...", [...]);
//   });
// Si el callback lanza un error se hace ROLLBACK automático.
// ============================================================
async function withTransaction(callback) {
  const client = await pool.connect();

  const tx = {
    query: async (sql, params = []) => {
      const result = await client.query(prepararSQL(sql), params);
      return formatearResultado(result);
    },
  };

  try {
    await client.query("BEGIN");
    const resultado = await callback(tx);
    await client.query("COMMIT");
    return resultado;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { query, withTransaction, pool };
