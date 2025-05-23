/// <reference types="Cypress" />

const URL = 'http://127.0.0.1:8080';


context('Smiles-Campana', () => {

  before(() => {
    cy.visit(URL);
  });


  describe('prueba 1', () => {
    it('Prueba que carguen todos los sectores', () => {

      cy.get('#home').should('exist');
      cy.get('#about').should('exist');
      cy.get('#news').should('exist');
      cy.get('#appointment').should('exist');
      cy.get('#google-map').should('exist');
    });
  });
  describe('prueba 2', () => {
    it('Prueba que carguen todas las imagenes', () => {
      cy.visit(URL);
      cy.get('img')
        .each($el => {
          expect($el).to.have.prop('naturalWidth').greaterThan(0)
        });
    });
  });
  describe('prueba 3', () => {
    it('test de links', () => {
      cy.visit(URL);
      cy.get('.noticia')
        .each((link) => {
          cy.request(link.prop('href'))
            .its('status')
            .should('eq', 200)
        });
    });
  });
});

