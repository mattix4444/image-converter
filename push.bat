git init
git add .
git commit -m "update"

git remote add origin https://github.com/mattix4444/image-converter.git

git branch -M main
git pull origin main --rebase

git push -u origin main