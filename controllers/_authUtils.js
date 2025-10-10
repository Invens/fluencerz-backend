// controllers/_authUtils.js
module.exports.getActor = async function getActor(db, req) {
    const userId = req.user?.id || null;
    let role = req.user?.userType || req.user?.role || null;
  
    const baseUser = userId ? await db.User.findByPk(userId) : null;
    const email = baseUser?.email || null;
  
    let brand = null;
    let influencer = null;
  
    // --- If role is declared, try the obvious path first ---
    if (role === 'brand') {
      // 1) new flow
      brand = await db.Brand.findOne({ where: { auth_user_id: userId } });
      // 2) by email (bridge legacy row)
      if (!brand && email) {
        brand = await db.Brand.findOne({ where: { email } });
        if (brand && !brand.auth_user_id && userId) {
          brand.auth_user_id = userId;
          await brand.save();
        }
      }
      // 3) legacy token (PK == Brand.id)
      if (!brand && userId) {
        brand = await db.Brand.findByPk(userId);
        if (brand && !brand.auth_user_id && baseUser) {
          brand.auth_user_id = baseUser.id;
          await brand.save();
        }
      }
    }
  
    if (role === 'influencer') {
      influencer = await db.Influencer.findOne({ where: { auth_user_id: userId } });
      if (!influencer && email) {
        influencer = await db.Influencer.findOne({ where: { email } });
        if (influencer && !influencer.auth_user_id && userId) {
          influencer.auth_user_id = userId;
          await influencer.save();
        }
      }
      if (!influencer && userId) {
        influencer = await db.Influencer.findByPk(userId);
        if (influencer && !influencer.auth_user_id && baseUser) {
          influencer.auth_user_id = baseUser.id;
          await influencer.save();
        }
      }
    }
  
    // --- If role missing in token, try to infer from email (legacy odd cases) ---
    if (!role && email) {
      if (!brand) brand = await db.Brand.findOne({ where: { email } });
      if (!influencer) influencer = await db.Influencer.findOne({ where: { email } });
  
      if (brand) role = 'brand';
      else if (influencer) role = 'influencer';
  
      // persist inferred role on User
      if (role && baseUser && !baseUser.user_type) {
        baseUser.user_type = role;
        await baseUser.save();
      }
      // bridge auth_user_id on the found record
      if (role === 'brand' && brand && !brand.auth_user_id && userId) {
        brand.auth_user_id = userId;
        await brand.save();
      }
      if (role === 'influencer' && influencer && !influencer.auth_user_id && userId) {
        influencer.auth_user_id = userId;
        await influencer.save();
      }
    }
  
    return { role, userId, email, baseUser, brand, influencer };
  };
  