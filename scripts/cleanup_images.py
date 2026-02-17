import os

def cleanup_images(directory):
    print(f"Limpando imagens originais em: {directory}")
    deleted_count = 0
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                filepath = os.path.join(root, file)
                # Check if corresponding webp exists before deleting
                webp_path = os.path.splitext(filepath)[0] + ".webp"
                if os.path.exists(webp_path):
                    try:
                        os.remove(filepath)
                        deleted_count += 1
                        print(f"Deletado: {file}")
                    except Exception as e:
                        print(f"Erro ao deletar {file}: {e}")
                else:
                    print(f"ALERTA: WebP não encontrado para {file}. Arquivo mantido.")
    print(f"Total removido em {directory}: {deleted_count}")

if __name__ == "__main__":
    confirm = input("Tem certeza que deseja deletar os arquivos originais (.jpg/.png)? Digite 'sim': ")
    if confirm.lower() == 'sim':
        cleanup_images("img")
        cleanup_images("atores")
    else:
        print("Operação cancelada.")
