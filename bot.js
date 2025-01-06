const mineflayer = require('mineflayer');
const express = require('express');
const pathfinder = require('mineflayer-pathfinder').pathfinder;

const config = require('./settings.json');
const loggers = require('./logging.js');
const logger = loggers.logger;

const app = express();
app.use('/images', express.static('images')); // Servir imagens estáticas
app.use(express.json());

// Estados das ações
const actions = {
  sprint: false,
  walkForward: false,
  antiAfk: false,
};

let antiAfkInterval = null;

// Configuração das ações dos botões
const buttonActions = {
  imagem1: 'Olá, mundo!',
  imagem2: '/say Teste 2',
  imagem3: 'Qualquer mensagem 3',
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
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          max-width: 600px;
          text-align: center;
        }
        .buttons {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 20px;
        }
        button {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          background-position: center;
          background-repeat: no-repeat;
          background-size: cover;
          border: none;
          cursor: pointer;
          transition: transform 0.2s;
        }
        button:hover {
          transform: translateY(-5px);
        }
        .switch-container {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
          margin-top: 30px;
        }
        .switch {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .slider {
          position: relative;
          cursor: pointer;
          width: 60px;
          height: 34px;
          background-color: #2196f3;
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
        label {
          font-size: 14px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Controle do Bot</h1>
        <div class="buttons">
          <button onclick="sendChatMessage('imagem1')" style="background-image: url('/images/imagem1.png');"></button>
          <button onclick="sendChatMessage('imagem2')" style="background-image: url('/images/imagem2.png');"></button>
          <button onclick="sendChatMessage('imagem3')" style="background-image: url('/images/imagem3.png');"></button>
          <button onclick="sendChatMessage('imagem4')" style="background-image: url('/images/imagem4.png');"></button>
          <button onclick="sendChatMessage('imagem5')" style="background-image: url('/images/imagem5.png');"></button>
          <button onclick="sendChatMessage('imagem6')" style="background-image: url('/images/imagem6.png');"></button>
        </div>
        <div class="switch-container">
          <div class="switch">
            <label>Corrida</label>
            <label>
              <input type="checkbox" id="sprint" onclick="toggleAction('sprint')">
              <span class="slider"></span>
            </label>
          </div>
          <div class="switch">
            <label>Andar para Frente</label>
            <label>
              <input type="checkbox" id="walkForward" onclick="toggleAction('walkForward')">
              <span class="slider"></span>
            </label>
          </div>
          <div class="switch">
            <label>Anti-AFK</label>
            <label>
              <input type="checkbox" id="antiAfk" onclick="toggleAction('antiAfk')">
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>
      <script>
        window.onload = () => {
          fetch('/get-actions')
            .then(res => res.json())
            .then(data => {
              Object.keys(data).forEach(action => {
                document.getElementById(action).checked = data[action];
              });
            });
        };

        function toggleAction(action) {
          const state = document.getElementById(action).checked;
          fetch('/toggle-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, state }),
          });
        }

        function sendChatMessage(button) {
          fetch('/send-chat-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ button }),
          });
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/toggle-action', (req, res) => {
  const { action, state } = req.body;
  if (actions.hasOwnProperty(action)) {
    actions[action] = state;
    controlBotActions();
  }
  res.sendStatus(200);
});

app.get('/get-actions', (req, res) => {
  res.json(actions);
});

app.post('/send-chat-message', (req, res) => {
  const { button } = req.body;
  if (global.bot && buttonActions[button]) {
    global.bot.chat(buttonActions[button]); // Envia a mensagem personalizada
  }
  res.sendStatus(200);
});

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
