# Monaco Editor

[Monaco Editor](https://microsoft.github.io/monaco-editor) is used in our project for two purposes:

1. As code editor
2. Input replacement when autocomplete for placeholders is needed

This page contains some FAQ to help understand how it is implemented.

## FAQ

### What is difference between `BasicEditor` and `MonacoEditor` ?

`BasicEditor` has only monaco editor which is used in `MonacoEditor` and `Input`. On top of that `MonacoEditor` contains the following extra features:

- Highlight whitespace characters
- Allow users to select language of the content displayed
- Different styling with numbers, line highlight etc

Use `MonacoEditor` if its being used as a code editor. Use `BasicEditor` if only the editor without any styling or customized settings needed.

### what is the code added in `AppRoot` ?

In the root component we have the following code:

```typescript
loader.config({ monaco });
```

We are using Monaco editor from a library named `@moanco-editor/react`. This library adds a wrapper around MonacoEditor so that it can be used in `react`.But the problem with it is it downloads all the code related to monaco from CDN. The above code snippet helps in loading the editor into the build so its always available when user opens the app.

### Do we have syntax highlighting for all supported languages ?

Yes. All supported languages have syntax highlighting enabled.

### Do we have syntax validation for all supported languages ?

No. Syntax highlighting is showing styles based on language tokens. We have that for the supported languages. Syntax validation is checking the syntax. By default Monaco provides syntax validation only for `JSON` and `Typescript/Javascript` files. We provide them too. Along with that, we use an external library to provide syntax validation for 'YAML' files.

### What is `placeholder` argument in Editor props ?

For all the languages, we allow users to add placeholders. Placeholders have custom syntax in the form `${<placeholder>}`. The prop allows us to pass in the array of objects which can be used for autocomplete of placeholders.

### What are custom language types ?

Different sections which use Input with Monaco editor needs different set of Placeholder values. But since we use a single instance of Monaco Editor, we can only set placeholders once to each language. If we try to set different values, it overrides the previous value and this causes bugs. To fix this, we are using different language for each placeholder set. The only language that is used in multiple sections is `text` files. So, text files are extended to different language types to hold different placeholder values. To not override already set values, we are maintaining a client side state using `Zustand` stores.

### What happens when user presses `tab` ?

Ideally in code editor, `tab` should insert a 'tab' character. But sometimes( like input) it should blur the field and go to next element. Fortunately Monaco supports both versions, we need to set the config accordingly. To do that, we check if the editor is used for input or not based on the prop named `usedForInput`. Based on that value we change the behaviour of `tab` key.

### What is `yamlSchema` prop ?

`YAML` files can be validated using `json-schema`. Refer [json-schema](https://json-schema.org/) to understand more. In `yamlSchema` prop we take the json-schema settings and validate yaml files based on that. If the prop is not passed, we just do basic syntax validation.
