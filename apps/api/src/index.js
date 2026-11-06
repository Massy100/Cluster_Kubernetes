require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const client = require("prom-client");

const app = express();
app.use(express.json({ limit: "32kb" }));

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 5000
});

client.collectDefaultMetrics();

const requests = new client.Counter({
  name: "kubelab_http_requests_total",
  help: "Total de solicitudes HTTP",
  labelNames: ["method", "route", "status"]
});

app.use((req, res, next) => {
  res.on("finish", () => {
    requests.inc({
      method: req.method,
      route: req.route?.path || "other",
      status: res.statusCode
    });
  });
  next();
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "okas", database: "connected" });
  } catch {
    res.status(503).json({
      status: "error",
      database: "disconnected"
    });
  }
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.send(await client.register.metrics());
});

app.get("/api/registros", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, descripcion FROM registros ORDER BY id"
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/registros/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, descripcion FROM registros WHERE id = $1",
      [req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "No encontrado" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/api/registros", async (req, res, next) => {
  try {
    const { nombre, descripcion = "" } = req.body;
    if (typeof nombre !== "string" ||
        !nombre.trim() ||
        typeof descripcion !== "string") {
      return res.status(400).json({ error: "Datos invalidos" });
    }

    const result = await pool.query(
      `INSERT INTO registros (nombre, descripcion)
       VALUES ($1, $2)
       RETURNING id, nombre, descripcion`,
      [nombre.trim(), descripcion]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/registros/:id", async (req, res, next) => {
  try {
    const { nombre, descripcion = "" } = req.body;
    if (typeof nombre !== "string" ||
        !nombre.trim() ||
        typeof descripcion !== "string") {
      return res.status(400).json({ error: "Datos invalidos" });
    }

    const result = await pool.query(
      `UPDATE registros
       SET nombre = $1, descripcion = $2
       WHERE id = $3
       RETURNING id, nombre, descripcion`,
      [nombre.trim(), descripcion, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "No encontrado" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/registros/:id", async (req, res, next) => {
  try {
    const result = await pool.query(
      "DELETE FROM registros WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "No encontrado" });
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error("API error:", error.message);
  res.status(500).json({ error: "Error interno del servidor" });
});

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registros (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      descripcion TEXT NOT NULL DEFAULT ''
    )
  `);

  const port = Number(process.env.PORT || 3000);
  app.listen(port, "0.0.0.0", () => {
    console.log("KubeLab API escuchando en puerto", port);
  });
}

start().catch(error => {
  console.error("No se pudo iniciar la API:", error.message);
  process.exit(1);
});
