const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const app = require("express")();

app.use(require("cors")());
app.use(require("cookie-parser")());

admin.initializeApp();

const firebase = require("firebase/app");
const {
	getAuth,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
} = require("firebase/auth");

const firebaseConfig = {
	apiKey: "AIzaSyClDXcqkOc3F_6eG5_Hc7E6lsUjvFpVDgQ",
	authDomain: "my-first-project-be65d.firebaseapp.com",
	projectId: "my-first-project-be65d",
	storageBucket: "my-first-project-be65d.appspot.com",
	messagingSenderId: "459162363006",
	appId: "1:459162363006:web:61e096ffd2d95fbbe1e42f",
};

firebase.initializeApp(firebaseConfig);

const db = admin.firestore();
const auth = admin.auth();

// AuthToken

const authenticateToken = async (req, res, next) => {
	const idToken = req.headers.authorization.split("Bearer ")[1];
	!idToken &&
		res.status(401).json({
			message: "Token not found",
		});

	try {
		const decodedToken = await auth.verifyIdToken(idToken);
		req.user = decodedToken;
		const userName = await db
			.collection("users")
			.where("uid", "==", req.user.uid)
			.limit(1)
			.get();
		req.user.name = userName.docs[0].data().name;
		next();
	} catch (error) {
		res.status(401).json({
			message: "Token not valid",
		});
	}
};

// Validator
const isEmail = (email) => {
	const regEx =
		/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
	return email.match(regEx) ? true : false;
};

const isPassword = (password) => {
	const regEx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
	return password.match(regEx) ? true : false;
};

const isEmpty = (data) => {
	return data.trim() === "" ? true : false;
};

const isError = (error) => {
	return Object.keys(error).length > 0 ? true : false;
};

// Signup Email
app.post("/signup", async (req, res) => {
	const { name, email, password, confirmPassword, address } = req.body;
	const newUser = {
		name,
		email,
		address,
		createdAt: new Date().toISOString(),
	};

	try {
		let errors = {};
		// Signup Validator
		isEmpty(email)
			? (errors.email = "Must not be empty")
			: !isEmail(email) && (errors.email = "Must be a valid email address");
		isEmpty(password)
			? (errors.password = "Must not be empty")
			: !isPassword(password)
			? (errors.password =
					"Password at least 8 characters and contains uppercase, lowercase, and number")
			: password !== confirmPassword &&
			  (errors.confirmPassword = "Passwords must match");
		isEmpty(name) && (errors.name = "Must not be empty");
		isEmpty(address) && (errors.address = "Must not be empty");

		if (isError(errors)) return res.status(400).json(errors);

		const checkData = await db.doc(`/users/${email}`).get();
		if (!checkData.exists) {
			const data = await createUserWithEmailAndPassword(
				getAuth(),
				email,
				password
			);

			const token = await data.user.getIdToken();
			const cookieOptions = {
				maxAge: 5 * 24 * 60 * 60 * 1000,
				httpOnly: false,
			};

			res.cookie("authToken", token, cookieOptions);

			const uid = data.user.uid;
			const userCredentials = {
				uid,
				name: newUser.name,
				email: newUser.email,
				address: newUser.address,
				createdAt: newUser.createdAt,
			};
			await db.doc(`/users/${email}`).set(userCredentials);

			return res.status(201).json({ token });
		}
	} catch (error) {
		error.message === "Firebase: Error (auth/email-already-in-use)."
			? res.status(400).json({ message: "Email already exist" })
			: res.status(500).json({ message: error.message });
	}
});

// login Email
app.post("/login", async (req, res) => {
	const { email, password } = req.body;
	try {
		let errors = {};
		// Login Validator
		isEmpty(email)
			? (errors.email = "Must not be empty")
			: !isEmail(email) && (errors.email = "Must be a valid email address");
		isEmpty(password) && (errors.password = "Must not be empty");
		Object.keys(errors).length > 0 && res.status(400).json(errors);

		const data = await signInWithEmailAndPassword(getAuth(), email, password);

		const token = await data.user.getIdToken();
		const cookieOptions = {
			maxAge: 5 * 24 * 60 * 60 * 1000,
			httpOnly: false,
		};

		res.cookie("authToken", token, cookieOptions);

		res.status(201).json({ token });
	} catch (error) {
		error.message === "Firebase: Error (auth/wrong-password)."
			? res.status(403).json({ message: "Wrong password, please try again" })
			: res.status(500).json({ message: error.message });
	}
});

// Logout
app.post("/logout", (req, res) => {
	res.clearCookie("authToken");

	// res.redirect("/")
	res.status(200).json({ message: "Logout sukses!" });
});

// Test
app.get("/", authenticateToken, async (req, res) => {
	try {
		const getUser = await db.collection("users").get();
		let user = [];
		getUser.forEach((doc) => {
			user.push(doc.data());
		});
		res.status(200).json({
			user,
			message: `Hello ${req.user.name}`,
		});
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

exports.api = onRequest(app);

// -"/signup/phone"