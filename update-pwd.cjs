const fs = require('fs');
const bcrypt = require('bcryptjs');

async function run() {
  const hash = await bcrypt.hash('fluir2026', 10);
  const data = JSON.parse(fs.readFileSync('src/backend/data/accounts.json', 'utf8'));
  const user = data.find(u => u.email === 'fluir@querocompetir.com.br');
  if (user) {
    user.passwordHash = hash;
    fs.writeFileSync('src/backend/data/accounts.json', JSON.stringify(data, null, 2));
    console.log('Password updated!');
  } else {
    console.log('User not found!');
  }
}
run();
