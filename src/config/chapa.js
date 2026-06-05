const Chapa = require('chapa');

const chapa = new Chapa(process.env.CHAPA_SECRET_KEY);

module.exports = chapa;
