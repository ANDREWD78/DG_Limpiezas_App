require('dotenv').config();
const sheets = require('./services/sheets');

async function check() {
    try {
        const users = await sheets.readSheetAsObjects('Usuarios');
        if (users.length > 0) {
            console.log('--- COLUMNAS ENCONTRADAS ---');
            console.log(Object.keys(users[0]).join(', '));
            console.log('--- USUARIO EJEMPLO ---');
            console.log(users[0]);
        } else {
            console.log('No se encontraron usuarios o la hoja está vacía.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
