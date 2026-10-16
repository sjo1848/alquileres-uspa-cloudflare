<template>
  <a class="skip-link" href="#main-content">Saltar al contenido</a>
  <header class="site-header">
    <h1><RouterLink to="/">Alquileres Uspallata</RouterLink></h1>
    <p class="site-caption">Propiedades y alquileres en Uspallata</p>
  </header>
  <main id="main-content" tabindex="-1">
    <RouterView />
  </main>
  <footer>Alquileres Uspallata</footer>
</template>
