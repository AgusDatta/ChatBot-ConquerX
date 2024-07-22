#!/bin/bash

# Directorio raíz donde se encuentran las carpetas de los usuarios
BASE_DIR="/path/to/BotsConquerX"

# Recorre cada carpeta de usuario dentro del directorio raíz
for user_dir in "$BASE_DIR"/*; do
    if [ -d "$user_dir/ChatBot-ConquerX" ]; then
        cd "$user_dir/ChatBot-ConquerX"
        echo "Actualizando bot en $user_dir/ChatBot-ConquerX"
        git add .
        git commit -m "update"
        git pull origin main
    fi
done

# Reiniciar todos los bots usando pm2
pm2 restart all

echo "Actualización y reinicio completados."
