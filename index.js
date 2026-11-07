const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const http = require('http');

// Memaksa modul crypto masuk ke global scope agar terbaca oleh Baileys
global.crypto = require('crypto');

// Web server mini untuk health check Railway
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot WA Minecraft is running!\n');
});
server.listen(process.env.PORT || 3000);

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.0"]
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "6281539875922"; 
        
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n========================================`);
                console.log(`📌 KODE PAIRING WHATSAPP KAMU: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.log("Gagal meminta kode pairing:", err);
            }
        }, 4000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            console.log('Koneksi terputus, status code:', statusCode);
            
            if (statusCode !== DisconnectReason.loggedOut) {
                setTimeout(() => startBot(), 5000);
            }
        } else if (connection === 'open') {
            console.log('🚀 Bot WhatsApp Berhasil Terhubung Sepenuhnya!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // Fitur pesan / command !village
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

        if (body && body.startsWith('!village')) {
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
            
