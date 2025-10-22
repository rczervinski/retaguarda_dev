#!/usr/bin/env python3
"""
Script para extrair imagens de PDFs usando pikepdf
Argumentos:
    1. Caminho do arquivo PDF
    2. Diretório de saída para as imagens
Saída: JSON com informações sobre as imagens extraídas
"""

import sys
import json
import os
from pathlib import Path

try:
    import pikepdf
    from PIL import Image
except ImportError as e:
    result = {
        "success": False,
        "images": [],
        "totalImages": 0,
        "error": f"Biblioteca necessária não instalada: {str(e)}. Execute: pip install pikepdf Pillow"
    }
    print(json.dumps(result))
    sys.exit(1)


def extract_images_from_pdf(pdf_path: str, output_dir: str) -> dict:
    """
    Extrai todas as imagens de um PDF
    
    Args:
        pdf_path: Caminho para o arquivo PDF
        output_dir: Diretório onde as imagens serão salvas
        
    Returns:
        Dicionário com informações sobre a extração
    """
    images_info = []
    image_count = 0
    
    try:
        # Abrir o PDF
        pdf = pikepdf.open(pdf_path)
        
        # Iterar por todas as páginas
        for page_num, page in enumerate(pdf.pages):
            # Obter recursos da página
            if '/Resources' not in page:
                continue
                
            resources = page.Resources
            
            if '/XObject' not in resources:
                continue
            
            xobjects = resources.XObject
            
            # Iterar por todos os XObjects (que podem ser imagens)
            for img_name in xobjects:
                xobject = xobjects[img_name]
                
                # Verificar se é uma imagem
                if not isinstance(xobject, pikepdf.Stream):
                    continue
                    
                if xobject.get('/Subtype') != '/Image':
                    continue
                
                try:
                    # Criar objeto PdfImage
                    pdfimage = pikepdf.PdfImage(xobject)
                    
                    # Converter para PIL Image (método mais confiável)
                    try:
                        pil_image = pdfimage.as_pil_image()
                        
                        # Converter CMYK para RGB se necessário
                        if pil_image.mode == 'CMYK':
                            pil_image = pil_image.convert('RGB')
                        
                        # Gerar nome do arquivo
                        filename = f"page_{page_num + 1}_img_{image_count + 1}.png"
                        output_path = os.path.join(output_dir, filename)
                        
                        # Salvar a imagem
                        pil_image.save(output_path, 'PNG')
                        
                        # Obter tamanho do arquivo
                        file_size = os.path.getsize(output_path)
                        
                        images_info.append({
                            "filename": filename,
                            "page": page_num,
                            "index": image_count,
                            "size": file_size
                        })
                        
                        image_count += 1
                        
                    except Exception as pil_error:
                        # Se PIL falhar, tentar extração direta
                        filename_base = f"page_{page_num + 1}_img_{image_count + 1}"
                        output_path_base = os.path.join(output_dir, filename_base)
                        
                        # extract_to retorna a extensão do arquivo
                        extension = pdfimage.extract_to(fileprefix=output_path_base)
                        
                        if extension:
                            filename = filename_base + extension
                            output_path = output_path_base + extension
                            
                            if os.path.exists(output_path):
                                file_size = os.path.getsize(output_path)
                                
                                images_info.append({
                                    "filename": filename,
                                    "page": page_num,
                                    "index": image_count,
                                    "size": file_size
                                })
                                
                                image_count += 1
                        else:
                            raise pil_error
                    
                except Exception as img_error:
                    # Log erro mas continua processando outras imagens
                    print(f"Aviso: Erro ao extrair imagem {img_name} da página {page_num + 1}: {str(img_error)}", 
                          file=sys.stderr)
                    continue
        
        pdf.close()
        
        return {
            "success": True,
            "images": images_info,
            "totalImages": image_count,
        }
        
    except Exception as e:
        return {
            "success": False,
            "images": [],
            "totalImages": 0,
            "error": f"Erro ao processar PDF: {str(e)}"
        }


def main():
    if len(sys.argv) != 3:
        result = {
            "success": False,
            "images": [],
            "totalImages": 0,
            "error": "Uso: python extrair-imagens-pdf.py <caminho_pdf> <diretorio_saida>"
        }
        print(json.dumps(result))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]
    
    # Validar entrada
    if not os.path.exists(pdf_path):
        result = {
            "success": False,
            "images": [],
            "totalImages": 0,
            "error": f"Arquivo PDF não encontrado: {pdf_path}"
        }
        print(json.dumps(result))
        sys.exit(1)
    
    # Criar diretório de saída se não existir
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Extrair imagens
    result = extract_images_from_pdf(pdf_path, output_dir)
    
    # Imprimir resultado como JSON
    print(json.dumps(result))
    
    # Código de saída
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
