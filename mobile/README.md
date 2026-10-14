# App Farma +

Aplicativo mobile (Ionic 7 + Angular 20 + Capacitor 8) do Sistemas Farma Mais.

- **Nome na tela:** App Farma +
- **Pacote Android:** `com.sistemasfarmamais.app`
- **API desenvolvimento:** `https://api-dev.sistemasfarmamais.com/api` (túnel para `localhost:3000`; o backend do OMNI precisa estar parado)
- **API produção:** `https://controledefichas.onrender.com/api`

## Desenvolvimento no navegador

```powershell
cd C:\PROJETOS\NEST_ANGULAR\mobile
npm install
npm run serve
```

Use `npm run serve`. O Ionic CLI precisa de `--project=mobile`.

## Emulador

Na raiz do repositório:

```powershell
.\run-emulator-clean.ps1
.\run-emulator-clean.ps1 -Production
.\run-emulator-clean.ps1 -NewVersion
```

O script desinstala só `com.sistemasfarmamais.app`. O app do OMNI (`com.omni.sistema`) permanece no mesmo emulador. Rode um script por vez: `gradlew --stop` e `adb logcat -c` afetam a máquina e o emulador inteiros.
