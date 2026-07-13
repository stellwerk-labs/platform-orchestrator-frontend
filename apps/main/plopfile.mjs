const plopFunction = (plop) => {
  plop.setGenerator('react-query-hooks', {
    description: 'Generate react query logic',
    prompts: [
      {
        type: 'input',
        name: 'folderName',
        message: 'Enter a name for the folder that would contain queries and mutations(lowercase):',
      },
      {
        type: 'input',
        name: 'numberOfQueries',
        message:
          'Enter number of query files you want created under the queries folder (numeric value only):',
        validate: (input) => {
          if (/^\d+$/.test(input)) {
            return true;
          }
          return 'Please enter a numeric value.';
        },
      },
      {
        type: 'checkbox',
        name: 'mutations',
        choices: ['Create', 'Update', 'Delete'],
        message: 'Choose the mutations you need',
      },
    ],
    actions: (data) => {
      const actions = [];
      if (data.numberOfQueries) {
        /** action for creating query keys file */
        actions.push({
          type: 'add',
          path: `src/hooks/react-query/{{dashCase folderName}}/{{camelCase folderName}}QueryKeys.ts`,
          templateFile: 'plop-templates/react-query/query-keys-template.hbs',
        });

        /** 'action for creating a query file based on the number of query files needed */
        for (let i = 1; i <= data.numberOfQueries; i++) {
          actions.push({
            type: 'add',
            path: `src/hooks/react-query/{{dashCase folderName}}/queries/use{{pascalCase folderName}}${
              data.numberOfQueries > 1 ? i : ''
            }Query.ts`,
            templateFile: 'plop-templates/react-query/query-template.hbs',
          });
        }
      }

      if (data.mutations) {
        for (const action of data.mutations) {
          let method;

          switch (action) {
            case 'Create':
              method = 'POST';
              break;
            case 'Update':
              method = 'PATCH';
              break;
            case 'Delete':
              method = 'DELETE';
              break;
            default:
              break;
          }

          actions.push({
            type: 'add',
            path: `src/hooks/react-query/{{dashCase folderName}}/mutations/use{{pascalCase folderName}}${action}Mutation.ts`,
            templateFile: 'plop-templates/react-query/mutation-template.hbs',
            data: {
              action,
              method,
            },
          });
        }
      }

      return actions;
    },
  });

  plop.setGenerator('unit-tests', {
    description: 'Generate vitest file',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'please enter test component name/file name :',
      },
      {
        type: 'input',
        name: 'path',
        message: 'please enter relative path to folder this file should be located in:',
      },
    ],
    actions: [
      {
        type: 'add',
        path: '{{path}}/{{pascalCase name}}.test.tsx',
        templateFile: 'plop-templates/vitest/unit-test.hbs',
      },
    ],
  });
};

export default plopFunction;
