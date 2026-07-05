Feature: VibeRender Agent Operations
  As a product marketer or 3D designer,
  I want to describe product scenes in natural language,
  So that I can generate executable Blender scripts and visualize 3D ad mockup renders.

  Scenario: Generating a 3D product mockup from text
    Given the agent is initialized with Blender script compiler skills
    When the user describes the scene "A sleek perfume bottle on a marble table in a forest setting at sunset"
    Then the agent should parse the prompt into objects, materials, and lighting settings
    And the agent should compile a valid Blender Python script using 'bpy'
    And the agent should trigger the local 3D render simulator
    And the agent should return the viewport render image, scene tree, and Blender code

  Scenario: Running automated evaluations for VibeRender
    Given the agent is initialized with Blender script compiler skills
    When the user triggers the EDD test suite
    Then the agent should run test cases through the orchestrator pipeline
    And the agent should trace and record tool invocation trajectories
    And the agent should write a detailed scorecard report
