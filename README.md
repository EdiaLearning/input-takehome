# Math input takehome

This repo has a basic implementation of a math input. You can run it with:
```
npm i
npm start
```

Your task is to answer the following questions:

1. Describe what unzipToCursor in Input/inputReducer.js returns. What is the point of it? What is its relationship to zip?
2. What are "implicit" parens? When/where do they come into existence and when are they eliminated? Comprehensively describe the rules governing them.
3. When doing a drag or shift select on the input, selectStartCursor and selectEffectiveStartCursor are set on the input state, e.g. at inputReducer.js:843. What are these properties and what is the difference between them? What are some situations where they will be the same and when they will be different?

Make the following changes:

1. Given the input "1 , 2 / 3", it puts "1,2" in the numerator. It should only put 2 in the numerator and leave 1, outside the fraction. Fix this. This should be a 1 line change.
2. Given the input "1 / bksp" it should leave just "1", not move the cursor up to the numerator. This should be a ~3 line change.
3. A common mistake is to write sqrt(2i) instead of sqrt(2)i. Make a change to insert the "i" outside of the square root if the cursor is immediately inside a square root expression. In other words, the input "s q r t i" should result in "sqrt( ) i". This should be a ~4 line change.
