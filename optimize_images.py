import os
from PIL import Image

def optimize_images(directory, max_width=800):
    print(f"Otimizando imagens em: {directory}")
    for root, dirs, files in os.walk(directory):
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
                        
                        # Remove original file (optional, commented out for safety)
                        # os.remove(filepath) 
                except Exception as e:
                    print(f"Erro ao processar {file}: {e}")

if __name__ == "__main__":
    optimize_images("img", max_width=800) # Poster size
    optimize_images("atores", max_width=300) # Actor card size
