# Panduan Testing Menu Telegram Bot

## Persiapan Testing

### 1. Pastikan Environment Variables
Pastikan file `.env` sudah dikonfigurasi dengan benar:

```bash
# Required
BOT_TOKEN=your_telegram_bot_token
ALLOWED_USERS=your_telegram_user_id
KIRO_CLI_PATH=/path/to/kiro-cli
WORKSPACE_PATH=/path/to/workspace

# Optional untuk notifikasi
NOTIFY_CHAT_ID=your_chat_id

# MCP Servers
GITHUB_TOKEN=your_github_token
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
VERCEL_TOKEN=your_vercel_token
```

### 2. Install Dependencies
```bash
cd bridge
npm install
```

### 3. Start Bot
```bash
# Development
node index.js

# Production dengan PM2
pm2 start ecosystem.config.js
```

## Test Cases untuk Menu Baru

### 1. Test Command Help/Start

**Input:**
```
/start
```
atau
```
/help
```

**Expected Output:**
- Pesan panduan lengkap dalam bahasa Indonesia
- Daftar semua command dengan contoh
- Format Markdown yang rapi dengan emoji

### 2. Test Menu Interaktif

**Input:**
```
/menu
```

**Expected Output:**
- Menu dengan inline keyboard buttons
- 6 tombol agent + broadcast
- 4 tombol untuk monitoring dan control
- Format yang rapi dengan emoji

**Follow-up Tests:**
- Klik setiap tombol agent (Backend, Frontend, dll)
- Klik tombol "Status Agent"
- Klik tombol "Logs" → pilih agent
- Klik tombol "Cancel Tasks" → pilih agent

### 3. Test Shortcut Commands

**Test Backend Shortcut:**
```
/be echo test backend agent
```

**Test Frontend Shortcut:**
```
/fe echo test frontend agent
```

**Test Testing Shortcut:**
```
/test echo test testing agent
```

**Test DevOps Shortcut:**
```
/ops echo test devops agent
```

**Test Reviewer Shortcut:**
```
/review echo test reviewer agent
```

**Expected Output untuk semua:**
- Pesan dikirim ke agent yang sesuai
- Typing indicator muncul
- Response dari agent yang dituju

### 4. Test Enhanced Status

**Input:**
```
/status
```
atau
```
/agents
```

**Expected Output:**
- Status dengan emoji untuk setiap agent
- Format Markdown yang rapi
- Informasi waktu untuk agent yang busy
- Emoji khusus untuk setiap agent (🔧🎨🧪⚙️👁️)

### 5. Test Enhanced Logs

**Input:**
```
/logs backend
```

**Expected Output:**
- Header dengan emoji agent
- Format timestamp yang konsisten
- Preview pesan yang terpotong dengan baik
- Markdown formatting

### 6. Test Enhanced Broadcast

**Input:**
```
/all echo test broadcast to all agents
```

**Expected Output:**
- Typing indicator selama proses
- Summary dengan emoji untuk setiap agent
- Informasi durasi dan status berhasil/gagal
- Format Markdown yang rapi

### 7. Test Error Handling

**Test Command Tidak Dikenal:**
```
/unknown
```

**Expected Output:**
- Pesan error dalam bahasa Indonesia
- Saran untuk menggunakan /help

**Test Agent Tidak Dikenal:**
```
/agent unknown test
```

**Expected Output:**
- Pesan error dengan daftar agent yang valid
- Format yang rapi dengan emoji

**Test Command Tanpa Parameter:**
```
/be
```

**Expected Output:**
- Pesan usage dengan contoh
- Format yang informatif

### 8. Test Callback Queries

**Dari Menu Utama:**
1. Klik "Backend" → harus muncul pesan instruksi
2. Klik "Status Agent" → harus muncul status
3. Klik "Logs" → harus muncul sub-menu logs
4. Klik "Cancel Tasks" → harus muncul sub-menu cancel

**Dari Sub-menu Logs:**
1. Klik "Backend" → harus muncul logs backend
2. Klik "Frontend" → harus muncul logs frontend

**Dari Sub-menu Cancel:**
1. Klik "Backend" → harus cancel task backend
2. Klik "Frontend" → harus cancel task frontend

## Checklist Testing

### ✅ Functionality Tests
- [ ] `/help` menampilkan panduan lengkap
- [ ] `/menu` menampilkan inline keyboard
- [ ] Shortcut commands (`/be`, `/fe`, dll) berfungsi
- [ ] `/status` menampilkan status dengan emoji
- [ ] `/logs <agent>` menampilkan logs dengan format baru
- [ ] `/all` broadcast dengan summary yang diperbaiki
- [ ] Callback queries dari inline keyboard berfungsi
- [ ] Error handling dalam bahasa Indonesia

### ✅ Visual Tests
- [ ] Emoji konsisten untuk setiap agent
- [ ] Markdown formatting berfungsi
- [ ] Pesan tidak terpotong atau rusak
- [ ] Inline keyboard tampil dengan benar
- [ ] Timestamp dalam format Indonesia

### ✅ UX Tests
- [ ] Menu mudah digunakan
- [ ] Pesan error informatif
- [ ] Navigation flow yang logis
- [ ] Response time yang wajar
- [ ] Typing indicator berfungsi

### ✅ Edge Cases
- [ ] Command dengan spasi ekstra
- [ ] Command dalam huruf besar/kecil
- [ ] Pesan sangat panjang (>4096 karakter)
- [ ] Multiple callback queries bersamaan
- [ ] Agent yang sedang busy/unavailable

## Troubleshooting

### Bot Tidak Merespon
1. Cek BOT_TOKEN di .env
2. Cek ALLOWED_USERS berisi user ID yang benar
3. Cek logs: `pm2 logs devmosel-bridge`

### Inline Keyboard Tidak Muncul
1. Pastikan `node-telegram-bot-api` versi terbaru
2. Cek error di console
3. Test dengan pesan sederhana dulu

### Callback Query Error
1. Cek implementasi `handleCallbackQuery`
2. Pastikan `answerCallbackQuery` dipanggil
3. Cek authentication di callback handler

### Format Markdown Rusak
1. Escape karakter khusus Markdown
2. Cek panjang pesan tidak melebihi limit
3. Test dengan `parse_mode: 'Markdown'`

## Performance Testing

### Load Testing
```bash
# Test multiple commands bersamaan
/status
/agents  
/menu
/help
```

### Memory Usage
```bash
# Monitor memory usage
pm2 monit
```

### Response Time
- Catat waktu response untuk setiap command
- Target: <2 detik untuk command sederhana
- Target: <10 detik untuk broadcast

## Monitoring

### Logs to Watch
```bash
# System logs
tail -f logs/system.log

# Agent logs  
tail -f logs/agent-backend.log

# PM2 logs
pm2 logs devmosel-bridge
```

### Metrics to Track
- Command response time
- Error rate
- Agent availability
- Memory usage
- CPU usage

Setelah semua test case berhasil, bot siap untuk production deployment.