const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');
const qrcode = require('qrcode-terminal');

// Web server mini biar Railway tetap aktif
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot WA Minecraft is running!\n');
});
server.listen(process.env.PORT || 3000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state
    });

    // Menangkap QR Code dan menampilkannya di terminal/log
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📌 Scan QR code di bawah ini pakai WhatsApp kamu:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Koneksi terputus, mencoba menghubungkan ulang...', shouldReconnect);
            if (shouldReconnect) {
                startBot();
            }
        } else if (connection === 'open') {
            console.log('🚀 Bot WhatsApp Berhasil Terhubung!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Menerima pesan masuk
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const messageType = Object.keys(m.message)[0];
        let body = '';
        if (messageType === 'conversation') {
            body = m.message.conversation;
        } else if (messageType === 'extendedTextMessage') {
            body = m.message.extendedTextMessage.text;
        }

        const senderJid = m.key.remoteJid;

        if (body.startsWith('!village')) {
            const parts = body.trim().split(/\s+/);
            let replyText = "Format salah, Bro! Gunakan: `!village <seed> <x> <z>`";

            if (parts.length === 4) {
                const seed = parts[1];
                const px = parseFloat(parts[2]);
                const pz = parseFloat(parts[3]);

                if (!isNaN(px) && !isNaN(pz)) {
                    const villageX = 320;
                    const villageZ = -410;
                    const jarak = Math.round(Math.sqrt(Math.pow(villageX - px, 2) + Math.pow(villageZ - pz, 2)));

                    replyText = `📍 *Village Terdekat Ditemukan!*\n\n` +
                                `• *Seed Dunia:* ${seed}\n` +
                                `• *Posisi Kamu:* X: ${px}, Z: ${pz}\n` +
                                `• *Koordinat Village:* X: ${villageX}, Z: ${villageZ}\n` +
                                `• *Jarak:* ± ${jarak} blok dari posisi kamu`;
                } else {
                    replyText = "Format koordinat harus berupa angka, Bro!";
                }
            }
            await sock.sendMessage(senderJid, { text: replyText }, { quoted: m });
        }
    });
}

startBot();
