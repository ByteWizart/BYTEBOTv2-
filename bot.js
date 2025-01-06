const mineflayer = require('mineflayer');
const express = require('express');
const pathfinder = require('mineflayer-pathfinder').pathfinder;

const config = require('./settings.json');
const loggers = require('./logging.js');
const logger = loggers.logger;
const app = express();

app.use('/images', express.static('images'));
app.use(express.json());

// Configuração dos botões
const buttonActions = {
  imagem1: 'Olá, mundo!',
  imagem2: '/say Teste 2',
  imagem3: 'Qualquer mensagem 3',
  imagem4: '/time set day',
  imagem5: '/effect give @a night_vision 999 255',
  imagem6: '/weather clear',
};

// Estados dos switches
const switches = {
  walkForward: false,
  sprint: false,
  antiAfk: false,
};

let antiAfkInterval = null;

// HTML da interface
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Controle do Bot</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f0f0f0;
          margin: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .container {
          background-color: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          max-width: 600px;
          text-align: center;
        }
        .buttons {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        button {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          border: none;
          background: linear-gradient(135deg, #1e90ff, #32a852);
          cursor: pointer;
          box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.3);
          transition: transform 0.2s, background-color 0.3s;
        }
        button:hover {
          transform: translateY(-5px);
          background: linear-gradient(135deg, #32a852, #1e90ff);
        }
        button img {
          width: 70%;
          height: 70%;
          border-radius: 50%;
        }
        .switch-container {
          margin-top: 20px;
        }
        .switch {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .slider {
          width: 50px;
          height: 24px;
          background: #ccc;
          border-radius: 50px;
          cursor: pointer;
          position: relative;
          transition: background 0.4s;
        }
        .slider::before {
          content: "";
          width: 20px;
          height: 20px;
          background: white;
          position: absolute;
          top: 2px;
          left: 2px;
          border-radius: 50%;
          transition: transform 0.3s;
        }
        input:checked + .slider {
          background: #4caf50;
        }
        input:checked + .slider::before {
          transform: translateX(26px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Controle do Bot</h1>
        <div class="buttons">
          ${Object.keys(buttonActions).map(
            (key) => `
              <button onclick="sendAction('${key}')">
                <img src="/images/${key}.png" alt="${key}">
              </button>
            `
          ).join('')}
        </div>
        <div class="switch-container">
          ${Object.keys(switches).map(
            (key) => `
              <div class="switch">
                <span>${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                <label>
                  <input type="checkbox" id="${key}" onchange="toggleSwitch('${key}')">
                  <span class="slider"></span>
                </label>
              </div>
            `
          ).join('')}
        </div>
      </div>
      <script>
        function sendAction(action) {
          fetch('/button-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          });
        }

        function toggleSwitch(switchName) {
          const state = document.getElementById(switchName).checked;
          fetch('/toggle-switch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ switchName, state }),
          });
        }
      </script>
    </body>
    </html>
  `);
});

// Ações dos botões
app.post('/button-action', (req, res) => {
  const { action } = req.body;
  if (buttonActions[action] && global.bot) {
    global.bot.chat(buttonActions[action]);
  }
  res.sendStatus(200);
});

// Alternar switches
app.post('/toggle-switch', (req, res) => {
  const { switchName, state } = req.body;
  if (switches.hasOwnProperty(switchName)) {
    switches[switchName] = state;
    controlBot();
  }
  res.sendStatus(200);
});

function controlBot() {
  if (global.bot) {
    global.bot.setControlState('forward', switches.walkForward);
    global.bot.setControlState('sprint', switches.sprint);

    if (switches.antiAfk) {
      startAntiAfk();
    } else {
      stopAntiAfk();
    }
  }
}

function startAntiAfk() {
  if (!antiAfkInterval) {
    antiAfkInterval = setInterval(() => {
      if (global.bot) {
        const yaw = global.bot.entity.yaw + Math.PI / 2;
        global.bot.look(yaw, global.bot.entity.pitch, true);
      }
    }, 5000);
  }
}

function stopAntiAfk() {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
}

// Reconexão do bot
function createBot() {
  const bot = mineflayer.createBot({
    host: config.server.ip,
    port: config.server.port,
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
  });

  global.bot = bot;

  bot.loadPlugin(pathfinder);

  bot.once('spawn', () => logger.info('Bot conectado com sucesso.'));
  bot.on('end', () => {
    logger.warn('Bot desconectado. Tentando reconectar em 5 segundos...');
    setTimeout(createBot, 5000);
  });
  bot.on('kicked', (reason) => logger.error(`Bot foi expulso: ${reason}`));
  bot.on('error', (err) => logger.error(err));
}

createBot();
app.listen(3000, () => logger.info('Servidor rodando na porta 3000.'));
