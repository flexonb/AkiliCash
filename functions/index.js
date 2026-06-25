const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.cleanupOnUserDelete = functions.auth.user().onDelete(async (user) => {
  const db = admin.firestore();
  const uid = user.uid;

  console.log(`User ${uid} deleted. Starting cleanup...`);

  // We need to find if this user was a client or a company admin/staff
  const profileRef = db.collection("profiles").doc(uid);
  const profileSnap = await profileRef.get();

  if (profileSnap.exists) {
    const profile = profileSnap.data();
    
    // If it's a company admin/staff, we might want to delete the company 
    // if they are the only admin, or just delete their profile.
    if (profile.user_type === "company_admin" || profile.user_type === "company_staff") {
      const companyId = profile.company_id;
      // If company admin, we might delete the entire company data if requested.
      // But for safety, we delete their profile. 
      // If we want to delete ALL associated details of the company:
      if (profile.user_type === "company_admin" && companyId) {
        console.log(`Deleting company ${companyId} data...`);
        
        // Delete company doc
        await db.collection("companies").doc(companyId).delete();
        await db.collection("settings").doc(companyId).delete();

        // Delete all clients of this company
        const clientsSnap = await db.collection("clients").where("company_id", "==", companyId).get();
        for (const doc of clientsSnap.docs) {
          await doc.ref.delete();
        }

        // Delete all loans
        const loansSnap = await db.collection("loans").where("company_id", "==", companyId).get();
        for (const doc of loansSnap.docs) {
          await doc.ref.delete();
        }

        // Delete all payments
        const paymentsSnap = await db.collection("payments").where("company_id", "==", companyId).get();
        for (const doc of paymentsSnap.docs) {
          await doc.ref.delete();
        }

        // Delete all expenses
        const expensesSnap = await db.collection("expenses").where("company_id", "==", companyId).get();
        for (const doc of expensesSnap.docs) {
          await doc.ref.delete();
        }
      }
    } else if (profile.user_type === "client") {
      // If client account, they are just a client.
      // Note: A client account is linked to `profiles`, but the actual `clients` record is created by the company.
      // Deleting a client profile removes their login access, but the company keeps their ledger unless the company deletes them.
      // We will just delete their profile here.
    }
    
    // Finally delete profile
    await profileRef.delete();
    console.log(`Cleanup complete for user ${uid}`);
  }
});

exports.adminCreateUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
  }
  const db = admin.firestore();
  
  // Verify the caller is an admin
  const callerProfileSnap = await db.collection("profiles").doc(context.auth.uid).get();
  if (!callerProfileSnap.exists || callerProfileSnap.data().user_type !== "company_admin") {
    throw new functions.https.HttpsError("permission-denied", "Only admins can create users.");
  }

  const callerProfile = callerProfileSnap.data();
  const companyId = callerProfile.company_id;

  const { email, password, full_name, role } = data;
  if (!email || !password || !full_name || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  try {
    // 1. Create the user in Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: full_name,
    });

    // 2. Create profile
    await db.collection("profiles").doc(userRecord.uid).set({
      id: userRecord.uid,
      full_name,
      user_type: "company_staff",
      company_id: companyId,
    });

    // 3. Set role if admin
    if (role === "admin") {
      await db.collection("user_roles").doc(userRecord.uid).set({
        user_id: userRecord.uid,
        role: "admin",
      });
      // also update user_type to company_admin
      await db.collection("profiles").doc(userRecord.uid).update({
        user_type: "company_admin"
      });
    }

    return { success: true, uid: userRecord.uid };
  } catch (error) {
    console.error("Error creating user:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
