const API = "/api/registros";

const form = document.getElementById("record-form");
const nombre = document.getElementById("nombre");
const descripcion = document.getElementById("descripcion");
const records = document.getElementById("records");
const message = document.getElementById("message");
const saveButton = document.getElementById("save");
const cancelButton = document.getElementById("cancel");

let editingId = null;
let currentRecords = [];

async function request(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function showMessage(text, error = false) {
  message.textContent = text;
  message.className = error ? "error" : "ok";
}

function resetForm() {
  editingId = null;
  form.reset();
  document.getElementById("form-title").textContent =
    "Crear registro";
  saveButton.textContent = "Guardar registro";
  cancelButton.hidden = true;
}

async function checkHealth() {
  const apiStatus = document.getElementById("api-status");
  const dbStatus = document.getElementById("db-status");

  try {
    const health = await request("/health");

    apiStatus.textContent = "Conectada";
    apiStatus.className = "ok";

    const connected = health.database === "connected";
    dbStatus.textContent = connected ? "Conectada" : "Sin conexión";
    dbStatus.className = connected ? "ok" : "error";
  } catch {
    apiStatus.textContent = "No disponible";
    apiStatus.className = "error";
    dbStatus.textContent = "Desconocido";
    dbStatus.className = "error";
  }
}

function createButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function renderRecords() {
  records.replaceChildren();

  document.getElementById("total").textContent =
    currentRecords.length;

  document.getElementById("table-count").textContent =
    `${currentRecords.length} registros`;

  if (!currentRecords.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No hay registros almacenados.";
    row.append(cell);
    records.append(row);
    return;
  }

  for (const record of currentRecords) {
    const row = document.createElement("tr");

    for (const value of [
      record.id,
      record.nombre,
      record.descripcion
    ]) {
      const cell = document.createElement("td");
      cell.textContent = String(value ?? "");
      row.append(cell);
    }

    const actions = document.createElement("td");

    actions.append(
      createButton("Editar", "small secondary", () => {
        editingId = record.id;
        nombre.value = record.nombre;
        descripcion.value = record.descripcion;

        document.getElementById("form-title").textContent =
          `Editar registro #${record.id}`;

        saveButton.textContent = "Actualizar registro";
        cancelButton.hidden = false;
        nombre.focus();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }),

      createButton("Eliminar", "small danger", async () => {
        if (!confirm(`¿Eliminar el registro #${record.id}?`)) {
          return;
        }

        try {
          await request(`${API}/${record.id}`, {
            method: "DELETE"
          });

          if (editingId === record.id) resetForm();

          showMessage("Registro eliminado correctamente.");
          await loadRecords();
        } catch (error) {
          showMessage(`Error al eliminar: ${error.message}`, true);
        }
      })
    );

    row.append(actions);
    records.append(row);
  }
}

async function loadRecords() {
  try {
    currentRecords = await request(API);
    renderRecords();
  } catch (error) {
    showMessage(`Error al consultar: ${error.message}`, true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    nombre: nombre.value.trim(),
    descripcion: descripcion.value.trim()
  };

  if (!payload.nombre) {
    showMessage("El nombre es obligatorio.", true);
    return;
  }

  const updating = editingId !== null;
  const url = updating ? `${API}/${editingId}` : API;

  saveButton.disabled = true;

  try {
    await request(url, {
      method: updating ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    resetForm();
    showMessage(
      updating ? "Registro actualizado." : "Registro creado."
    );
    await loadRecords();
  } catch (error) {
    showMessage(`Error al guardar: ${error.message}`, true);
  } finally {
    saveButton.disabled = false;
  }
});

cancelButton.addEventListener("click", resetForm);

document.getElementById("refresh").addEventListener(
  "click",
  async () => {
    await Promise.all([checkHealth(), loadRecords()]);
  }
);

checkHealth();
loadRecords();