// Petit script progressif : le site fonctionne sans JavaScript.
// (La CSP interdit les scripts inline : tout le comportement est ici.)
document.addEventListener('DOMContentLoaded', () => {
  // Confirmation avant les actions destructrices : <form data-confirmer="Message ?">
  document.querySelectorAll('form[data-confirmer]').forEach((form) => {
    form.addEventListener('submit', (evt) => {
      if (!window.confirm(form.dataset.confirmer)) evt.preventDefault();
    });
  });

  // Formulaire utilisateur (back-office) : le champ « association » n'a de sens que pour un responsable.
  const role = document.querySelector('[data-role-select]');
  const champAssociation = document.querySelector('[data-champ-association]');
  if (role && champAssociation) {
    const maj = () => { champAssociation.hidden = role.value !== 'responsable'; };
    role.addEventListener('change', maj);
    maj();
  }
});
