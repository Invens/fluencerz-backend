-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Sep 08, 2025 at 01:39 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `appmontize`
--

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `skype` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('super_admin','moderator') DEFAULT 'super_admin',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `full_name`, `email`, `phone`, `skype`, `password_hash`, `role`, `created_at`) VALUES
(1, 'Abhishek', 'admin@appmontize.com', '9999999999', 'admin.skype', '$2b$10$svyeKGxJb9of5QE7iJ0tVuVamznR8HXQRYqiXjcdKlAERA/Rg9S56', 'super_admin', '2025-03-21 09:31:18');

-- --------------------------------------------------------

--
-- Table structure for table `brands`
--

CREATE TABLE `brands` (
  `id` int(11) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `contact_person` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `skype` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `industry` varchar(100) NOT NULL,
  `website` varchar(255) DEFAULT NULL,
  `budget_range` varchar(100) DEFAULT NULL,
  `campaign_goal` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `profile_image` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `campaigns`
--

CREATE TABLE `campaigns` (
  `id` int(11) NOT NULL,
  `collab_request_id` int(11) NOT NULL,
  `campaign_status` enum('in_progress','completed','cancelled') DEFAULT 'in_progress',
  `deliverables` text DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `quotation_amount` decimal(10,2) DEFAULT NULL,
  `performance_metrics` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`performance_metrics`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `collab_requests`
--

CREATE TABLE `collab_requests` (
  `id` int(11) NOT NULL,
  `brand_id` int(11) NOT NULL,
  `influencer_id` int(11) NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `request_message` text DEFAULT NULL,
  `admin_response` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `influencers`
--

CREATE TABLE `influencers` (
  `id` int(11) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `skype` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `profile_picture` varchar(255) DEFAULT NULL,
  `niche` varchar(100) NOT NULL,
  `followers_count` int(11) NOT NULL,
  `engagement_rate` float DEFAULT NULL,
  `portfolio` text DEFAULT NULL,
  `availability` enum('available','unavailable') DEFAULT 'available',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `profile_image` varchar(255) DEFAULT NULL,
  `social_platforms` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`social_platforms`)),
  `followers_by_country` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`followers_by_country`)),
  `audience_age_group` varchar(50) DEFAULT NULL,
  `audience_gender` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`audience_gender`)),
  `total_reach` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `influencers`
--

INSERT INTO `influencers` (`id`, `full_name`, `email`, `phone`, `skype`, `password_hash`, `profile_picture`, `niche`, `followers_count`, `engagement_rate`, `portfolio`, `availability`, `created_at`, `updated_at`, `profile_image`, `social_platforms`, `followers_by_country`, `audience_age_group`, `audience_gender`, `total_reach`) VALUES
(10, 'Abhishek kumar', 'info@apple.com', '8586085646', 'k', '$2b$10$v5xfnF5yd.DVOMmiXCrx5ui37rxdIacxF4u.Sw2C5em.4nOL6WX.a', NULL, 'Photography', 9090, 89, 'I am a Nature photographer.', 'available', '2025-04-16 06:41:49', '2025-04-16 09:18:50', NULL, '[{\"platform\":\"Instagram\",\"followers\":\"8908\"}]', NULL, '18-24', NULL, 89080),
(11, 'Rushali', 'rushali@appmontize.co.in', '8586085646', 'hellome', '$2b$10$uBpbc2LLj7zVGzOj8YTYxu/CdSfuOlx4BSd6gbUYiHQVujCf6N7CO', NULL, 'Tech', 459399, 34, 'ji', 'available', '2025-04-17 12:13:40', '2025-04-17 12:13:40', NULL, '[]', '[{\"country\":\"Singapore\",\"percentage\":\"98\"}]', '35-44', '{\"male\":49,\"female\":49,\"other\":2}', 3439390),
(12, 'Abhishek kumar', 'support@abhishekkumar.com', '8586085646', 'linkme', '$2b$10$Rp6nlrfML46SmYw290dS1OxsYaGZx79nSprYMHdEGKPkPBa9w/1N2', NULL, 'Tech', 50000, 5, '', 'available', '2025-09-08 10:49:26', '2025-09-08 10:49:26', NULL, '[{\"platform\":\"Instagram\",\"followers\":\"259999\"}]', '[{\"country\":\"Singapore\",\"percentage\":\"100\"}]', '18-24', '{\"male\":\"20\",\"female\":\"60\",\"other\":\"20\"}', 230000);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_type` enum('brand','influencer','admin') NOT NULL,
  `user_id` int(11) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` int(11) NOT NULL,
  `campaign_id` int(11) NOT NULL,
  `brand_id` int(11) NOT NULL,
  `influencer_id` int(11) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_status` enum('pending','completed','failed') DEFAULT 'pending',
  `transaction_id` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ratings`
--

CREATE TABLE `ratings` (
  `id` int(11) NOT NULL,
  `campaign_id` int(11) NOT NULL,
  `rated_by` enum('admin','brand') NOT NULL,
  `rating_value` int(11) DEFAULT NULL CHECK (`rating_value` between 1 and 5),
  `review` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `brands`
--
ALTER TABLE `brands`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_brand_industry` (`industry`),
  ADD KEY `idx_brand_budget` (`budget_range`);

--
-- Indexes for table `campaigns`
--
ALTER TABLE `campaigns`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `collab_request_id` (`collab_request_id`),
  ADD KEY `idx_campaign_status` (`campaign_status`);

--
-- Indexes for table `collab_requests`
--
ALTER TABLE `collab_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_collab_request_brand` (`brand_id`),
  ADD KEY `idx_collab_request_influencer` (`influencer_id`),
  ADD KEY `idx_collab_request_status` (`status`);

--
-- Indexes for table `influencers`
--
ALTER TABLE `influencers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD KEY `idx_influencer_niche` (`niche`),
  ADD KEY `idx_influencer_followers` (`followers_count`),
  ADD KEY `idx_influencer_engagement` (`engagement_rate`),
  ADD KEY `idx_influencer_availability` (`availability`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user` (`user_id`),
  ADD KEY `idx_notifications_read_status` (`is_read`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `campaign_id` (`campaign_id`),
  ADD UNIQUE KEY `transaction_id` (`transaction_id`),
  ADD KEY `brand_id` (`brand_id`),
  ADD KEY `influencer_id` (`influencer_id`),
  ADD KEY `idx_payment_status` (`payment_status`);

--
-- Indexes for table `ratings`
--
ALTER TABLE `ratings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `campaign_id` (`campaign_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `brands`
--
ALTER TABLE `brands`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `campaigns`
--
ALTER TABLE `campaigns`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `collab_requests`
--
ALTER TABLE `collab_requests`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `influencers`
--
ALTER TABLE `influencers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ratings`
--
ALTER TABLE `ratings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `campaigns`
--
ALTER TABLE `campaigns`
  ADD CONSTRAINT `campaigns_ibfk_1` FOREIGN KEY (`collab_request_id`) REFERENCES `collab_requests` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `collab_requests`
--
ALTER TABLE `collab_requests`
  ADD CONSTRAINT `collab_requests_ibfk_1` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `collab_requests_ibfk_2` FOREIGN KEY (`influencer_id`) REFERENCES `influencers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payments_ibfk_2` FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payments_ibfk_3` FOREIGN KEY (`influencer_id`) REFERENCES `influencers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `ratings`
--
ALTER TABLE `ratings`
  ADD CONSTRAINT `ratings_ibfk_1` FOREIGN KEY (`campaign_id`) REFERENCES `campaigns` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
