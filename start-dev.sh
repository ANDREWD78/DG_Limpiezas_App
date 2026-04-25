#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  DG Limpiezas App — Script de arranque en desarrollo
#  Uso: ./start-dev.sh  (desde la raíz del proyecto)
# ─────────────────────────────────────────────────────────────────────────────

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo ""
echo "🧹 DG Limpiezas App — Iniciando entorno de desarrollo"
echo "──────────────────────────────────────────────────────"
echo "  Backend  → http://localhost:3001"
echo "  Frontend → http://localhost:4173"
echo ""
echo "  Ctrl+C para parar todo."
echo "──────────────────────────────────────────────────────"
echo ""

# Función de limpieza al salir
cleanup() {
  echo ""
  echo "🛑 Parando procesos..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
  echo "✅ Procesos detenidos."
}
trap cleanup INT TERM EXIT

# Arrancar backend
echo "▶ Arrancando backend (puerto 3001)..."
cd "$BACKEND_DIR"
npm run dev &
BACKEND_PID=$!
cd "$SCRIPT_DIR"

# Breve pausa para que el backend empiece a escuchar
sleep 2

# Arrancar frontend
echo "▶ Arrancando frontend (puerto 4173)..."
cd "$FRONTEND_DIR"
npx serve . -p 4173 &
FRONTEND_PID=$!
cd "$SCRIPT_DIR"

echo ""
echo "✅ Ambos servicios arrancados."
echo "   Abre en el navegador: http://localhost:4173"
echo ""

# Esperar a que alguno de los dos procesos termine (o Ctrl+C)
wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || wait "$BACKEND_PID" "$FRONTEND_PID"
