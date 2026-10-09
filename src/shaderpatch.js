// Várias alterações de shader no mesmo material (eclipses, luzes noturnas, sombras dos anéis…) sem uma apagar a outra.
// Cada patch recebe o shader do three.js e troca trechos de texto antes de compilar.
export function addPatch(material, key, fn) {
  const list = (material.userData.patches ||= []);
  if (list.some(p => p.key === key)) return;
  list.push({ key, fn });
  material.onBeforeCompile = sh => { for (const p of list) p.fn(sh); };
  material.customProgramCacheKey = () => list.map(p => p.key).join('+');
  material.needsUpdate = true;
}
// Insere código logo depois de um #include (mantendo o include)
export const after = (src, include, code) => src.replace(`#include <${include}>`, `#include <${include}>\n${code}`);
export const before = (src, include, code) => src.replace(`#include <${include}>`, `${code}\n#include <${include}>`);
