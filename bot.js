.on('error', (err) => logger.error(err));
}

createBot();
app.listen(3000, () => logger.info('Servidor rodando na porta 3000.'));
const mineflayer = require('mineflayer');
const express = require('express');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;

const config = require('./settings.json');
const loggers = require('./logging.js');
const logger = loggers.logger;
const app = express();

app.use('/images', express.static('images'));
app.use(express.json());

// Estados das ações
const actions = {
  sprint: false,
  walkForward: false,
  antiAfk: false,
};

// Referência do bot global
let antiAfkInterval = null;

// Mensagens personalizadas para botões
const messages = {
  imagem1: 'Mensagem personalizada 1',
  imagem2: 'Mensagem personalizada 2',
  imagem3: 'Mensagem personalizada 3',
  imagem4: '/time set day',
  imagem5: '/effect give @a night_vision 999 255',
  imagem6: '/weather clear',
};

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bot Controller</title>
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
          margin: 20px 0;
        }
        button {
          width: 100px;
          height: 100px;
          background: linear-gradient(135deg, #32a852, #1e90ff);
          border: none;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s ease;
        }
        button:hover {
          transform: translateY(-5px);
        }
        button img {
          width: 70%;
          height: 70%;
          object-fit: cover;
          border-radius: 50%;
        }
        .switch-container {
          margin-top: 20px;
        }
        .switch {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 10px 0;
        }
        .slider {
          position: relative;
          cursor: pointer;
          width: 60px;
          height: 34px;
          background-color: #ccc;
          border-radius: 34px;
          transition: background-color 0.4s;
        }
        .slider:before {
          content: '';
          position: absolute;
          height: 26px;
          width: 26px;
          left: 4px;
          bottom: 4px;
          background-color: white;
          border-radius: 50%;
          transition: transform 0.4s;
        }
        input:checked + .slider {
          background-color: #4caf50;
        }
        input:checked + .slider:before {
          transform: translateX(26px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Controle do Bot</h1>
        <div class="buttons">
          <button id="imagem1" onclick="sendChatMessage('imagem1')"><img src="/images/imagem1.png" alt="Imagem 1"></button>
          <button id="imagem2" onclick="sendChatMessage('imagem2')"><img src="/images/imagem2.png" alt="Imagem 2"></button>
          <button id="imagem3" onclick="sendChatMessage('imagem3')"><img src="/images/imagem3.png" alt="Imagem 3"></button>
          <button id="imagem4" onclick="sendChatMessage('imagem4')"><img src="/images/imagem4.png" alt="Imagem 4"></button>
          <button id="imagem5" onclick="sendChatMessage('imagem5')"><img src="/images/imagem5.png" alt="Imagem 5"></button>
          <button id="imagem6" onclick="sendChatMessage('imagem6')"><img src="/images/imagem6.png" alt="Imagem 6"></button>
        </div>
        <div class="switch-container">
          <div class="switch">
            <span>Ativar Corrida</span>
            <label>
              <input type="checkbox" id="sprint" onclick="toggleAction('sprint')">
              <span class="slider"></span>
            </label>
          </div>
          <div class="switch">
            <span>Andar para Frente</span>
            <label>
              <input type="checkbox" id="walkForward" onclick="toggleAction('walkForward')">
              <span class="slider"></span>
            </label>
          </div>
          <div class="switch">
            <span>Ativar Anti-AFK</span>
            <label>
              <input type="checkbox" id="antiAfk" onclick="toggleAction('antiAfk')">
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
      <script>
        function sendChatMessage(button) {
          fetch('/send-chat-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ button }),
          });
        }
        function toggleAction(action) {
          const state = document.getElementById(action).checked;
          fetch('/toggle-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, state }),
          });
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/send-chat-message', (req, res) => {
  const { button } = req.body;
  if (global.bot && messages[button]) {
    global.bot.chat(messages[button]);
  }
  res.sendStatus(200);
});

app.post('/toggle-action', (req, res) => {
  const { action, state } = req.body;
  if (actions.hasOwnProperty(action)) {
    actions[action] = state;
    controlBotActions();
  }
  res.sendStatus(200);
});

// Controla as ações do bot
function controlBotActions() {
  if (global.bot) {
    global.bot.setControlState('forward', actions.walkForward);
    global.bot.setControlState('sprint', actions.sprint);
    if (actions.antiAfk) {
      startAntiAfk();
    } else {
      stopAntiAfk();
    }
  }
}

// Inicia o modo Anti-AFK
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

// Para o modo Anti-AFK
function stopAntiAfk() {
  if (antiAfkInterval) {
    clearInterval(antiAfkInterval);
    antiAfkInterval = null;
  }
}

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  global.bot = bot;
  bot.loadPlugin(pathfinder);
  bot.once('spawn', () => {
    logger.info('Bot entrou no servidor.');
  });
  bot.on('error', (err) => logger.error(err.message));
}

createBot();
app.listen(3000, () => logger.info('Servidor rodando na porta 3000.'));
