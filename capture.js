const { spawn } = require('child_process');
const axios = require('axios');

// 🔥 IMPORTANT: Use deployed backend URL
const API_URL = process.env.API_URL || "https://siem-khy8.onrender.com";

// 🔧 Network Interface (change if needed)
const INTERFACE = process.env.INTERFACE || '1';

// 🧠 Packet buffer (to avoid spam)
let packetBuffer = [];

// 🚀 Start tshark
const tshark = spawn('tshark', [
    '-i', INTERFACE,
    '-l',
    '-T', 'fields',
    '-e', 'ip.src',
    '-e', 'ip.dst',
    '-e', '_ws.col.Protocol',
    '-e', 'dns.qry.name',
    '-e', 'http.host'
]);

console.log(`🚀 Listening on interface: ${INTERFACE}`);

// 🧠 Process packets
tshark.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');

    lines.forEach((line) => {
        if (!line) return;

        const parts = line.split('\t');

        const source_ip = parts[0]?.trim();
        const destination_ip = parts[1]?.trim();
        const protocolRaw = parts[2]?.trim();
        const dns = parts[3]?.trim();
        const http = parts[4]?.trim();

        // ❌ Skip invalid packets
        if (!source_ip || !destination_ip || !protocolRaw) return;

        const protocol = protocolRaw.toUpperCase();

        let website = null;
        if (dns) website = dns;
        else if (http) website = http;

        const packet = {
            source_ip,
            destination_ip,
            protocol,
            website
        };

        console.log(
            `📡 ${source_ip} → ${destination_ip} → ${protocol} → ${website || '-'}`
        );

        // 🔥 Add to buffer instead of sending immediately
        packetBuffer.push(packet);
    });
});

// 🚀 Send packets in batch every 2 seconds
setInterval(async () => {
    if (packetBuffer.length === 0) return;

    const batch = [...packetBuffer];
    packetBuffer = [];

    try {
        await axios.post(`${API_URL}/packets/bulk`, batch, {
            timeout: 5000
        });

        console.log(`✅ Sent ${batch.length} packets`);
    } catch (err) {
        console.error("❌ API Error:", err.message);
    }
}, 2000);

// ❌ Tshark errors
tshark.stderr.on('data', (err) => {
    console.error("❌ Tshark Error:", err.toString());
});

// 🔚 Exit handling
tshark.on('close', (code) => {
    console.log(`⚠️ Tshark exited with code ${code}`);
});
