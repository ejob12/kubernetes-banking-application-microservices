const fs = require("fs");
const path = require("path");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createId(prefix) {
  const time = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}_${time}_${random}`;
}

function createStore(defaultState) {
  const filePath = process.env.DATA_FILE;
  let state = clone(defaultState);

  if (filePath && fs.existsSync(filePath)) {
    try {
      state = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      console.warn(`Could not read ${filePath}. Starting with seed data.`, error.message);
    }
  }

  function save() {
    if (!filePath) {
      return;
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
    fs.renameSync(tempPath, filePath);
  }

  return {
    state,
    save,
  };
}

module.exports = {
  clone,
  createId,
  createStore,
};
