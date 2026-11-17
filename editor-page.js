// Full-screen edit workspace and cross-parent moves. Loaded after editor.js.

let editorTree = null;

function openEditorPage() {
  const sheet = menuOverlay.querySelector('.menu-sheet');
  sheet.classList.add('editor-page-mode');
  sheet.querySelector('.menu-top h2').textContent = 'Edit your Galaxy';
  const layout = element('div', 'editor-page-layout');
  editorTree = element('nav', 'editor-tree');
  editorTree.setAttribute('aria-label', 'Galaxy link tree');
  const pane = element('section', 'editor-pane');
  layout.append(editorTree, pane);
  menuRoot.replaceChildren(layout);
  menuContent = pane;
  renderEditorTree();
  showSunList();
  editorTree.querySelector('button')?.focus();
}

function leaveEditorPage() {
  menuOverlay.querySelector('.menu-sheet').classList.remove('editor-page-mode');
  menuOverlay.querySelector('.menu-top h2').textContent = 'Explore the menu';
  editorTree = null;
  menuContent = menuRoot;
  showMenuPanel('Settings');
  menuRoot.querySelector('.editor-open')?.focus();
}

function renderEditorTree() {
  if (!editorTree) return;
  editorTree.replaceChildren(element('h3', '', 'Galaxy'));
  groups.forEach((sun, sunIndex) => {
    const sunButton = editorButton(`${sun.name} · ${sun.links.length} planets`,
      () => showSunEditor(sunIndex), 'editor-tree-item editor-tree-sun');
    editorTree.append(sunButton);
    sun.links.forEach((planet, planetIndex) => {
      const planetButton = editorButton(`${planet.name} · ${planet.moons.length} moons`,
        () => showPlanetEditor(sunIndex, planetIndex), 'editor-tree-item editor-tree-planet');
      editorTree.append(planetButton);
      planet.moons.forEach((moon, moonIndex) => {
        const moonButton = editorButton(moon.name,
          () => showMoonEditor(sunIndex, planetIndex, moonIndex), 'editor-tree-item editor-tree-moon');
        editorTree.append(moonButton);
      });
    });
  });
}

function moveTargetField(options) {
  const field = element('label', 'editor-field');
  field.append(element('span', '', 'Move to'));
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Move to');
  options.forEach(([value, label]) => {
    const option = element('option', '', label);
    option.value = value;
    select.append(option);
  });
  field.append(select);
  menuContent.append(field);
  return select;
}

function showMovePlanet(sunIndex, planetIndex) {
  const sun = groups[sunIndex];
  const planet = sun.links[planetIndex];
  editorHeader(`Move ${planet.name}`, () => showPlanetEditor(sunIndex, planetIndex));
  menuContent.append(element('p', '', `From ${sun.name} sun. Its moons move with it.`));
  const options = groups.flatMap((target, index) => index === sunIndex ? [] : [[String(index), target.name]]);
  if (!options.length) {
    menuContent.append(element('p', '', 'Add another sun before moving this planet.'));
    return;
  }
  const select = moveTargetField(options);
  editorActions().append(editorButton('Move planet', () => {
    const targetSunIndex = Number(select.value);
    const next = copyGroups();
    const [moved] = next[sunIndex].links.splice(planetIndex, 1);
    next[targetSunIndex].links.push(moved);
    applyEditorChange(next, () => showPlanetEditor(targetSunIndex, next[targetSunIndex].links.length - 1));
  }, 'editor-primary'));
}

function showMoveMoon(sunIndex, planetIndex, moonIndex) {
  const sun = groups[sunIndex];
  const planet = sun.links[planetIndex];
  const moon = planet.moons[moonIndex];
  editorHeader(`Move ${moon.name}`, () => showMoonEditor(sunIndex, planetIndex, moonIndex));
  menuContent.append(element('p', '', `From ${sun.name} sun → ${planet.name} planet.`));
  const options = groups.flatMap((targetSun, targetSunIndex) => targetSun.links.flatMap(
    (targetPlanet, targetPlanetIndex) => targetSunIndex === sunIndex && targetPlanetIndex === planetIndex
      ? [] : [[`${targetSunIndex}:${targetPlanetIndex}`, `${targetSun.name} → ${targetPlanet.name}`]]));
  if (!options.length) {
    menuContent.append(element('p', '', 'Add another planet before moving this moon.'));
    return;
  }
  const select = moveTargetField(options);
  editorActions().append(editorButton('Move moon', () => {
    const [targetSunIndex, targetPlanetIndex] = select.value.split(':').map(Number);
    const next = copyGroups();
    const [moved] = next[sunIndex].links[planetIndex].moons.splice(moonIndex, 1);
    const targetMoons = next[targetSunIndex].links[targetPlanetIndex].moons;
    targetMoons.push(moved);
    applyEditorChange(next, () => showMoonEditor(targetSunIndex, targetPlanetIndex, targetMoons.length - 1));
  }, 'editor-primary'));
}
