#!/bin/bash

# Preguntar el número de usuarios a crear
read -p "¿Cuántos usuarios vamos a crear? " num_users

# Array para almacenar los nombres de los usuarios
user_names=()

# Obtener los nombres de las carpetas para cada usuario
for ((i=1; i<=num_users; i++)); do
    read -p "Nombre para el usuario $i: " user_name
    user_names+=("$user_name")
done

# Preguntar por el link del repositorio
read -p "Ingrese el link del repositorio para clonar: " repo_link

# Directorio base
BASE_DIR=$(pwd)

# Crear las carpetas y clonar el repositorio
for user_name in "${user_names[@]}"; do
    user_dir="$BASE_DIR/$user_name"
    mkdir -p "$user_dir"
    cd "$user_dir"
    echo "Clonando repositorio en $user_dir"
    git clone "$repo_link"
    cd "$user_dir/ChatBot-ConquerX"
    echo "Instalando dependencias en $user_dir/ChatBot-ConquerX"
    npm install
done

echo "Setup completado para $num_users usuarios."
