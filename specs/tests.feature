Feature: ClinicalGenie Agent Operations
  As a clinician or genetic researcher,
  I want to search genomic variants and genes,
  So that I can identify pathogenicity, biological pathways, matched clinical trials, and drug safety warnings.

  Scenario: Searching a genetic variant by rsID
    Given the agent is initialized with active database skills
    When the user searches for variant "rs7412"
    Then the agent should query the dbSNP database for variant details
    And the agent should query ClinVar for clinical significance
    And the agent should query ClinicalTrials.gov for matched clinical trials
    And the agent should query OpenFDA for drug safety warnings and events
    And the agent should return a resolved variant profile with clinical synthesis

  Scenario: Searching a genetic variant by genomic coordinates
    Given the agent is initialized with active database skills
    When the user searches for coordinates "19 44908684 T C"
    Then the agent should resolve coordinates to an rsID using dbSNP
    And the agent should retrieve pathogenicity and clinical data from ClinVar
    And the agent should retrieve active clinical trials matching the associated gene
    And the agent should return the clinical matching report

  Scenario: Searching by gene symbol
    Given the agent is initialized with active database skills
    When the user searches for gene "BRCA1"
    Then the agent should identify associated biological pathways using Reactome
    And the agent should fetch active clinical trials for the gene
    And the agent should synthesize a research summary memo
