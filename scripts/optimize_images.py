import os
from PIL import Image

import shutil

def optimize_images(directory, max_width=800):
    print(f"Otimizando imagens em: {directory}")
    
    # Create backup directory if it doesn't exist
    backup_dir = os.path.join(directory, "originais")
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
        
    # Count processed files
    processed_count = 0
        
    for root, dirs, files in os.walk(directory):
        # Skip the backup directory itself
        if "originais" in root:
            continue
            
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                filepath = os.path.join(root, file)
                try:
                    with Image.open(filepath) as img:
                        # Resize if too big
                        if img.width > max_width:
                            ratio = max_width / img.width
                            new_height = int(img.height * ratio)
                            img = img.resize((max_width, new_height), Image.Resampling.LANCZOS)
                        
                        # Convert to WebP
                        new_filename = os.path.splitext(file)[0] + ".webp"
                        new_filepath = os.path.join(root, new_filename)
                        
                        img.save(new_filepath, "WEBP", quality=80)
                        print(f"Convertido: {file} -> {new_filename}")
                        
                        # Move original file to backup
                        backup_path = os.path.join(backup_dir, file)
                        # Handle duplicate names in backup
                        if os.path.exists(backup_path):
                            base, ext = os.path.splitext(file)
                            backup_path = os.path.join(backup_dir, f"{base}_{int(time.time())}{ext}")
                            
                        shutil.move(filepath, backup_path)
                        print(f"Original movido para: {backup_path}")
                        processed_count += 1
                        
                except Exception as e:
                    print(f"Erro ao processar {file}: {e}")
    
    if processed_count == 0:
        print("Nenhuma imagem nova (.jpg, .png) encontrada para converter.")
    else:
        print(f"Concluído! {processed_count} imagens processadas.")

if __name__ == "__main__":
    import time # Import time for timestamping backups
    optimize_images("Posters", max_width=800) # Poster size
    optimize_images("atores", max_width=300) # Actor card size
