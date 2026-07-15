#!/usr/bin/env bash
#
# tag-release.sh — Automatiza el tageo de releases para UdelarHITS
#
# Uso:
#   ./tag-release.sh patch   -> v1.0.0 -> v1.0.1
#   ./tag-release.sh minor   -> v1.0.0 -> v1.1.0
#   ./tag-release.sh major   -> v1.0.0 -> v2.0.0
#
# Qué hace:
#   1. Busca el último tag (vX.Y.Z) del repo.
#   2. Calcula la próxima versión según el tipo de bump pedido.
#   3. Arma el mensaje del tag listando los commits desde el último tag.
#   4. Te muestra un preview y pide confirmación antes de crear/pushear nada.
#
# Requiere: estar parado en la raíz del repo, con git instalado.

set -euo pipefail

BUMP_TYPE="${1:-}"

if [[ -z "$BUMP_TYPE" || ! "$BUMP_TYPE" =~ ^(major|minor|patch)$ ]]; then
  echo "Uso: $0 <major|minor|patch>"
  echo "Ejemplo: $0 minor"
  exit 1
fi

# --- 1. Verificar que estamos en un repo git y en la rama correcta ---

if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "Error: esto no es un repositorio git."
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  read -p "Estás en '$CURRENT_BRANCH', no en 'main'. ¿Seguir igual? (s/N): " CONFIRM_BRANCH
  if [[ "$CONFIRM_BRANCH" != "s" && "$CONFIRM_BRANCH" != "S" ]]; then
    echo "Cancelado."
    exit 1
  fi
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Error: hay cambios sin commitear. Commiteá o hacé stash antes de taggear."
  exit 1
fi

# --- 2. Buscar el último tag ---

LAST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || echo "")"

if [[ -z "$LAST_TAG" ]]; then
  echo "No se encontró ningún tag previo. Se asume que este va a ser el primero."
  LAST_TAG="v0.0.0"
  COMMIT_RANGE="HEAD"
else
  COMMIT_RANGE="${LAST_TAG}..HEAD"
fi

echo "Último tag: $LAST_TAG"

# --- 3. Calcular la próxima versión ---

VERSION="${LAST_TAG#v}"
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"

case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1)); PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_TAG="v${MAJOR}.${MINOR}.${PATCH}"

if git rev-parse "$NEW_TAG" > /dev/null 2>&1; then
  echo "Error: el tag $NEW_TAG ya existe. Revisá el bump o borrá el tag existente si fue un error."
  exit 1
fi

# --- 4. Armar el changelog desde los commits ---

COMMITS="$(git log "$COMMIT_RANGE" --pretty=format:'- %s' --no-merges 2>/dev/null || echo "")"

if [[ -z "$COMMITS" ]]; then
  COMMITS="- (sin commits nuevos desde $LAST_TAG — completar manualmente)"
fi

TAG_MESSAGE="$NEW_TAG

$COMMITS"

# --- 5. Preview y confirmación ---

echo ""
echo "========================================"
echo " Nuevo tag: $NEW_TAG  (bump: $BUMP_TYPE)"
echo "========================================"
echo "$TAG_MESSAGE"
echo "========================================"
echo ""

read -p "¿Editar el mensaje antes de crear el tag? (s/N): " EDIT_MSG
if [[ "$EDIT_MSG" == "s" || "$EDIT_MSG" == "S" ]]; then
  TMP_FILE="$(mktemp)"
  echo "$TAG_MESSAGE" > "$TMP_FILE"
  "${EDITOR:-nano}" "$TMP_FILE"
  TAG_MESSAGE="$(cat "$TMP_FILE")"
  rm -f "$TMP_FILE"
fi

read -p "¿Crear el tag $NEW_TAG? (s/N): " CONFIRM_TAG
if [[ "$CONFIRM_TAG" != "s" && "$CONFIRM_TAG" != "S" ]]; then
  echo "Cancelado. No se creó ningún tag."
  exit 0
fi

git tag -a "$NEW_TAG" -m "$TAG_MESSAGE"
echo "Tag $NEW_TAG creado localmente."

read -p "¿Pushear el tag a origin ahora? (s/N): " CONFIRM_PUSH
if [[ "$CONFIRM_PUSH" == "s" || "$CONFIRM_PUSH" == "S" ]]; then
  git push origin "$NEW_TAG"
  echo "Tag $NEW_TAG pusheado a origin."
else
  echo "Recordá pushearlo después con: git push origin $NEW_TAG"
fi
