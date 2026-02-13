import os
import time
from PIL import Image
import shutil

# Configuration
WATCH_DIR = "Posters"
OUTPUT_DIR = "Posters" # Convert in place, or change to "img" if you want to move them
BACKUP_DIR = "Posters/originais" # To store originals before deleting
EXTENSIONS = {'.jpg', '.jpeg', '.png'}

def ensure_dir(directory):
    if not os.path.exists(directory):
        os.makedirs(directory)

def convert_images():
    ensure_dir(BACKUP_DIR)
    
    # List files
    files = [f for f in os.listdir(WATCH_DIR) if os.path.isfile(os.path.join(WATCH_DIR, f))]
    
    conversions_count = 0
    
    for filename in files:
        name, ext = os.path.splitext(filename)
        if ext.lower() in EXTENSIONS:
            filepath = os.path.join(WATCH_DIR, filename)
            webp_path = os.path.join(OUTPUT_DIR, f"{name}.webp")
            
            # Check if webp already exists (if so, maybe skip or overwrite?)
            # Logic: If original exists and we are here, we convert.
            
            try:
                print(f"🔄 Convertendo: {filename}...")
                with Image.open(filepath) as img:
                    # Save as WebP
                    img.save(webp_path, 'WEBP', quality=85)
                
                print(f"✅ Sucesso: {webp_path}")
                
                # Move original to backup
                shutil.move(filepath, os.path.join(BACKUP_DIR, filename))
                conversions_count += 1
                
            except Exception as e:
                print(f"❌ Erro ao converter {filename}: {e}")

    if conversions_count > 0:
        print(f"🎉 Total de {conversions_count} imagens convertidas.")

def main():
    print(f"👀 Monitorando a pasta '{WATCH_DIR}' por novas imagens...")
    print("Pressione CTRL+C para parar.")
    
    while True:
        convert_images()
        time.sleep(3) # Check every 3 seconds

if __name__ == "__main__":
    main()
